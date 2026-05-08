import {prisma} from '@/lib/prisma'
import {NextResponse} from 'next/server'
import {auth} from "@/auth"
import {hash} from 'bcryptjs'
import {
  recordSalaryAppraisal,
  logSalaryAppraisalActivity,
  type SalaryAppraisalChange,
} from "@/lib/services/salary-appraisal"

const ALLOWED_STATUSES = ['ACTIVE', 'PARTIAL_INACTIVE', 'INACTIVE', 'PENDING', 'JOB_OFFER'] as const
type AllowedStatus = (typeof ALLOWED_STATUSES)[number]

function normalizeStatus(value: unknown): AllowedStatus | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  return (ALLOWED_STATUSES as readonly string[]).includes(normalized)
    ? (normalized as AllowedStatus)
    : null
}

// Helper function to convert Excel date or DD/MM/YYYY string to Date object
function parseDate(dateValue: string | number): Date {
  // If it's a number (Excel date serial number)
  if (typeof dateValue === 'number') {
    // Excel dates are number of days since Dec 30, 1899
    const excelEpoch = new Date(1899, 11, 30);
    const offsetDays = dateValue;
    const resultDate = new Date(excelEpoch);
    resultDate.setDate(resultDate.getDate() + offsetDays);
    return resultDate;
  }


  // If it's a string in DD/MM/YYYY format
  const [day, month, year] = dateValue.split('/').map(num => parseInt(num, 10));
  return new Date(year, month - 1, day);
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    // @ts-expect-error role
    if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
      return NextResponse.json({error: 'Unauthorized'}, {status: 401})
    }

    const {users} = await request.json()

    const logUserId = (session.user as { id?: string }).id
    if (!logUserId) {
      return NextResponse.json({error: 'Unauthorized'}, {status: 401})
    }

    const salaryChanges: SalaryAppraisalChange[] = []

    await prisma.$transaction(async (tx) => {
      for (const userData of users) {
        // Handle branch based on role
        let branchId = null;
        let managedBranchId = null;
        // For all roles except MANAGEMENT and HR, try to assign branch if provided
        if (['MANAGEMENT', 'HR', 'EMPLOYEE', 'BRANCH_MANAGER'].includes(userData['Role*']) && userData['Branch*']) {
          const existingBranch = await tx.branch.findFirst({
            where: { 
              name: userData['Branch*'] as string 
            }
          });

          if (userData['Role*'] === 'BRANCH_MANAGER') {
            managedBranchId = existingBranch?.id;
          }

          
          if (existingBranch) {
            branchId = existingBranch.id;
          }
        }

        // Prepare references data
        const references = [];
        if (userData['Reference 1 Name*']) {
          references.push({
            name: userData['Reference 1 Name*'],
            contactNo: userData['Reference 1 Contact*']
          });
        }
        if (userData['Reference 2 Name']) {
          references.push({
            name: userData['Reference 2 Name'],
            contactNo: userData['Reference 2 Contact']
          });
        }

        // Try to find existing user by id or numId
        const existingUser = await tx.user.findFirst({
          where: {
            OR: [
              { id: userData.id },
              { numId: Number(userData.numId) }
            ]
          },
          include: { references: true }
        });

        // Map department name to departmentId
        let departmentId = null;
        if (userData['Department*']) {
          const department = await tx.department.findFirst({
            where: {
              name: userData['Department*'] as string
            }
          });
          if (department) {
            departmentId = department.id;
          } else {
            // If department doesn't exist, create it
            const newDepartment = await tx.department.create({
              data: {
                name: userData['Department*'] as string,
                isActive: true,
              }
            });
            departmentId = newDepartment.id;
          }
        }

        // Resolve the status the import wants to apply. The client now sends
        // the row's actual Status (ACTIVE / PARTIAL_INACTIVE / INACTIVE / …);
        // older clients only sent ACTIVE/INACTIVE based on the sheet name.
        //
        // - If the supplied value is one of the allowed statuses, use it.
        // - Otherwise: for existing users, KEEP their current status (don't
        //   silently demote a PARTIAL_INACTIVE user to ACTIVE/INACTIVE just
        //   because the import didn't include a valid status).
        // - For new users (no existing record), default to ACTIVE.
        const requestedStatus = normalizeStatus(userData.status)
        const resolvedStatus: AllowedStatus =
          requestedStatus
            ?? (existingUser ? (existingUser.status as AllowedStatus) : 'ACTIVE')

        // Common user data
        const userCommonData = {
          name: userData['Name*'],
          email: userData['Email*'],
          mobileNo: userData['Mobile No*'].toString(),
          gender: userData['Gender*'],
          departmentId: departmentId,
          title: userData['Title*'],
          role: userData['Role*'],
          // Parse dates from DD-MM-YYYY format
          dob: parseDate(userData['DOB*']),
          doj: parseDate(userData['DOJ*']),
          salary: parseFloat(userData['Salary*']),
          panNo: userData['PAN No*'],
          aadharNo: userData['Aadhar No*'].toString(),
          bankAccountNo: userData['Bank Account No*'].toString(),
          bankIfscCode: userData['Bank IFSC Code*'].toString(),
          branchId: branchId,
          status: resolvedStatus,
          managedBranchId: managedBranchId,
        };

        if (existingUser) {
          // Update existing user
          await tx.user.update({
            where: { id: existingUser.id },
            data: userCommonData
          });

          // Track salary change → appraisal record + activity log (logged after commit)
          const change = await recordSalaryAppraisal({
            tx,
            userId: existingUser.id,
            previousSalary: existingUser.salary,
            newSalary: userCommonData.salary,
            changedById: logUserId,
          });
          if (change) salaryChanges.push(change);

          // Delete existing references
          await tx.reference.deleteMany({
            where: { userId: existingUser.id }
          });

          // Create new references
          await tx.reference.createMany({
            data: references.map(ref => ({
              ...ref,
              userId: existingUser.id
            }))
          });
        } else {
          // Create new user
          const newUser = await tx.user.create({
            data: {
              ...userCommonData,
              password: await hash('password123', 12),
            }
          });

          // Create references for new user
          await tx.reference.createMany({
            data: references.map(ref => ({
              ...ref,
              userId: newUser.id
            }))
          });
        }
      }
    }, {
      timeout: 200000,
      maxWait: 10000,
    });

    // Activity logs are written outside the transaction to keep the tx short
    for (const change of salaryChanges) {
      await logSalaryAppraisalActivity({
        change,
        changedById: logUserId,
        source: "bulk import",
        request,
      });
    }

    return NextResponse.json({
      message: 'Users imported successfully',
      appraisalsCreated: salaryChanges.length,
    })
  } catch (error) {
    console.error('Import failed:', error)
    return NextResponse.json(
      {error: 'Failed to import users'},
      {status: 500}
    )
  }
} 
