import {prisma} from '@/lib/prisma'
import {NextResponse} from 'next/server'
import {auth} from "@/auth"
import {hash} from 'bcryptjs'

// Helper function to convert DD-MM-YYYY to Date object
function parseDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split('-').map(num => parseInt(num, 10));
  return new Date(year, month - 1, day); // month is 0-based in JS Date
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    // @ts-expect-error role
    if (!session || !['HR', 'MANAGEMENT'].includes(session.user.role)) {
      return NextResponse.json({error: 'Unauthorized'}, {status: 401})
    }

    const {users} = await request.json()

    await prisma.$transaction(async (tx) => {
      for (const userData of users) {
        // Handle branch based on role
        let branchId = null;
        if (userData['Role*'] === 'EMPLOYEE') {
          // First find branch by name
          const existingBranch = await tx.branch.findFirst({
            where: { 
              name: userData['Branch*'] as string 
            }
          });

          // Create branch if it doesn't exist
          const branch = existingBranch || await tx.branch.create({
            data: {
              name: userData['Branch*'] as string,
              address: '',
              city: '',
              state: ''
            }
          });

          branchId = branch.id;
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

        // Try to find existing user by email
        const existingUser = await tx.user.findUnique({
          where: {email: userData['Email*']},
          include: {references: true}
        });

        // Common user data
        const userCommonData = {
          name: userData['Name*'],
          mobileNo: userData['Mobile No*'].toString(),
          gender: userData['Gender*'],
          department: userData['Department*'],
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
        };

        if (existingUser) {
          // Update existing user
          await tx.user.update({
            where: {id: existingUser.id},
            data: userCommonData
          });

          // Delete existing references
          await tx.reference.deleteMany({
            where: {userId: existingUser.id}
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
              email: userData['Email*'],
              password: await hash('password123', 12),
              status: 'ACTIVE',
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
    });

    return NextResponse.json({message: 'Users imported successfully'})
  } catch (error) {
    console.error('Import failed:', error)
    return NextResponse.json(
      {error: 'Failed to import users'},
      {status: 500}
    )
  }
} 
