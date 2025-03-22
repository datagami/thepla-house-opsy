import {prisma} from '@/lib/prisma'
import {NextResponse} from 'next/server'
import {auth} from "@/auth"
import {hash} from 'bcryptjs'

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
        // Find or create branch
        const branch = await tx.branch.upsert({
          where: {name: (userData['Branch*'] as string) || ''},
          update: {},
          create: {
            name: userData['Branch*'],
            address: '',
            city: '',
            state: ''
          }
        });

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
        if (userData['Reference 3 Name']) {
          references.push({
            name: userData['Reference 3 Name'],
            contactNo: userData['Reference 3 Contact']
          });
        }

        // Try to find existing user by email
        const existingUser = await tx.user.findUnique({
          where: {email: userData['Email*']},
          include: {references: true}
        });

        if (existingUser) {
          // Update existing user
          await tx.user.update({
            where: {id: existingUser.id},
            data: {
              name: userData['Name*'],
              mobileNo: userData['Mobile No*'],
              gender: userData['Gender*'],
              department: userData['Department*'],
              title: userData['Title*'],
              role: userData['Role*'],
              dob: new Date(userData['DOB*']),
              doj: new Date(userData['DOJ*']),
              salary: parseFloat(userData['Salary*']),
              panNo: userData['PAN No*'],
              aadharNo: userData['Aadhar No*'],
              bankAccountNo: userData['Bank Account No*'],
              bankIfscCode: userData['Bank IFSC Code*'],
              branchId: branch.id,
            }
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
              name: userData['Name*'],
              email: userData['Email*'],
              password: await hash('password123', 12),
              mobileNo: userData['Mobile No*'],
              gender: userData['Gender*'],
              department: userData['Department*'],
              title: userData['Title*'],
              role: userData['Role*'],
              status: 'ACTIVE',
              dob: new Date(userData['DOB*']),
              doj: new Date(userData['DOJ*']),
              salary: parseFloat(userData['Salary*']),
              panNo: userData['PAN No*'],
              aadharNo: userData['Aadhar No*'],
              bankAccountNo: userData['Bank Account No*'],
              bankIfscCode: userData['Bank IFSC Code*'],
              branchId: branch.id,
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
