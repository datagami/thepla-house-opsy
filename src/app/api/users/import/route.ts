import {prisma} from '@/lib/prisma'
import {NextResponse} from 'next/server'
import {auth} from "@/auth"
import {hash} from 'bcryptjs'

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

  console.log('parse date');
  
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

        console.log(userData.numId);

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

        // Common user data
        const userCommonData = {
          name: userData['Name*'],
          email: userData['Email*'],
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
          status: userData.status || 'ACTIVE',
        };

        if (existingUser) {
          // Update existing user
          await tx.user.update({
            where: { id: existingUser.id },
            data: userCommonData
          });

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

    return NextResponse.json({message: 'Users imported successfully'})
  } catch (error) {
    console.error('Import failed:', error)
    return NextResponse.json(
      {error: 'Failed to import users'},
      {status: 500}
    )
  }
} 
