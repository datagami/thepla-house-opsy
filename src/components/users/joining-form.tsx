import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { User } from '@prisma/client';
import path from 'path';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
  },
  imageContainer: {
    marginBottom: 20,
    display: 'flex',
    alignItems: 'center',
  },
  userImage: {
    width: 100,
    height: 100,
    objectFit: 'cover',
    borderRadius: '50%',
  },
  section: {
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    marginBottom: 5,
    fontWeight: 'bold',
  },
  value: {
    fontSize: 12,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  column: {
    flex: 1,
  },
  signatureSection: {
    marginTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureLine: {
    borderBottom: '1pt solid black',
    width: 200,
    marginTop: 30,
  },
});

interface JoiningFormProps {
  user: User;
}

export function JoiningForm({ user }: JoiningFormProps) {
  // Get user image path
  const userImagePath = user.image ? path.join(process.cwd(), 'public', user.image) : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {userImagePath && (
          <View style={styles.imageContainer}>
            <Image src={userImagePath} style={styles.userImage} />
          </View>
        )}
        
        <View style={styles.section}>
          <Text style={styles.label}>Personal Information</Text>
          <View style={styles.row}>
            <View style={styles.column}>
              <Text style={styles.value}>Name: {user.name}</Text>
              <Text style={styles.value}>Employee ID: {user.numId}</Text>
              <Text style={styles.value}>Date of Birth: {user.dob ? new Date(user.dob).toLocaleDateString() : 'N/A'}</Text>
            </View>
            <View style={styles.column}>
              <Text style={styles.value}>Email: {user.email}</Text>
              <Text style={styles.value}>Mobile: {user.mobileNo}</Text>
              <Text style={styles.value}>Gender: {user.gender}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Employment Details</Text>
          <View style={styles.row}>
            <View style={styles.column}>
              <Text style={styles.value}>Department: {user.department}</Text>
              <Text style={styles.value}>Title: {user.title}</Text>
              <Text style={styles.value}>Role: {user.role}</Text>
            </View>
            <View style={styles.column}>
              <Text style={styles.value}>Branch: {user.branchId}</Text>
              <Text style={styles.value}>Date of Joining: {user.doj ? new Date(user.doj).toLocaleDateString() : 'N/A'}</Text>
              <Text style={styles.value}>Salary: ₹{user.salary}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Bank Details</Text>
          <Text style={styles.value}>Account Number: {user.bankAccountNo}</Text>
          <Text style={styles.value}>IFSC Code: {user.bankIfscCode}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Government IDs</Text>
          <Text style={styles.value}>PAN: {user.panNo}</Text>
          <Text style={styles.value}>Aadhar: {user.aadharNo}</Text>
        </View>

        <View style={styles.signatureSection}>
          <View>
            <Text style={styles.value}>Employee Signature</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.value}>Date: _________________</Text>
          </View>
          <View>
            <Text style={styles.value}>HR Signature</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.value}>Date: _________________</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
} 
