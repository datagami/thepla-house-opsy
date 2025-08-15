# Joining Form E-Signature Feature

## Overview

The e-signature feature allows employees to digitally sign their joining forms, eliminating the need for physical paperwork. This feature provides a secure, legally binding way to capture employee consent and agreement to company terms and conditions.

## Features

### 1. Digital Signature Pad
- HTML5 Canvas-based signature capture
- Support for mouse and touch input
- Real-time signature preview
- Clear signature functionality

### 2. Terms and Conditions
- Comprehensive terms and conditions display
- Scrollable content for readability
- Required agreement checkbox
- Legal compliance features

### 3. Signature Management
- Secure storage of signature data as base64 images
- Timestamp tracking of when signatures were captured
- User tracking of who signed the form
- Agreement status tracking

### 4. User Interface
- Clean, professional signature interface
- Employee information summary
- Status indicators and progress tracking
- Responsive design for all devices

## Database Schema

The following fields have been added to the `users` table:

```sql
ALTER TABLE "users1" ADD COLUMN "joining_form_signed_at" TIMESTAMP(3);
ALTER TABLE "users1" ADD COLUMN "joining_form_signed_by" TEXT;
ALTER TABLE "users1" ADD COLUMN "joining_form_signature" TEXT;
ALTER TABLE "users1" ADD COLUMN "joining_form_agreement" BOOLEAN NOT NULL DEFAULT false;
```

### Field Descriptions

- `joining_form_signed_at`: Timestamp when the form was signed
- `joining_form_signed_by`: User ID of who signed the form
- `joining_form_signature`: Base64 encoded signature image
- `joining_form_agreement`: Boolean indicating agreement to terms

## User Roles and Permissions

### Employee
- Can sign their own joining form
- Can view their signature status
- Cannot sign forms for other users

### HR/Management
- Can sign joining forms for any employee
- Can view all signature statuses
- Can access pending signatures dashboard widget
- Can manage signature process

## API Endpoints

### POST `/api/users/[id]/joining-form-signature`
Submits a digital signature for a user's joining form.

**Request Body:**
```json
{
  "signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "agreement": true
}
```

**Response:**
```json
{
  "message": "Joining form signed successfully",
  "user": {
    "id": "user_id",
    "name": "Employee Name",
    "joiningFormSignedAt": "2024-01-15T10:30:00Z"
  }
}
```

### GET `/api/users/[id]/joining-form-signature`
Retrieves the signature status for a user.

**Response:**
```json
{
  "signed": true,
  "signedAt": "2024-01-15T10:30:00Z",
  "signedBy": "user_id",
  "agreement": true
}
```

## Components

### SignaturePad
- Location: `src/components/users/signature-pad.tsx`
- Purpose: Canvas-based signature capture component
- Features: Mouse/touch support, clear functionality, validation

### JoiningFormESignature
- Location: `src/components/users/joining-form-esignature.tsx`
- Purpose: Complete e-signature form with terms and conditions
- Features: Employee info display, terms acceptance, signature capture

### SignatureStatus
- Location: `src/components/users/signature-status.tsx`
- Purpose: Display signature status and captured signature
- Features: Status indicators, signature preview, action buttons

### PendingSignaturesWidget
- Location: `src/components/dashboard/pending-signatures-widget.tsx`
- Purpose: Dashboard widget for HR/Management to track pending signatures
- Features: Quick access to sign forms, user list, status overview

## Pages

### E-Signature Page
- Route: `/users/[id]/joining-form-signature`
- Purpose: Dedicated page for signing joining forms
- Features: Full-screen signature interface, terms display, validation

## Integration Points

### User Profile Form
- Added "Sign Joining Form" button for unsigned users
- Shows signature status for signed users
- Integrated with existing user management workflow

### User Table
- Added "Joining Form" column showing signature status
- Visual indicators for signed/pending status
- Quick access to sign forms via dropdown menu

### User Actions
- Added "Sign Joining Form" option in user actions dropdown
- Conditional display based on signature status
- Direct link to signature page

### Dashboard
- Added pending signatures widget for HR/Management
- Shows count of users needing signatures
- Quick access to sign forms

## Security Features

1. **Permission-based Access**: Only authorized users can sign forms
2. **Ownership Validation**: Users can only sign their own forms (unless HR/Management)
3. **Duplicate Prevention**: Forms can only be signed once
4. **Audit Trail**: Complete tracking of who signed when
5. **Data Validation**: Server-side validation of signature data

## Legal Compliance

1. **Terms and Conditions**: Clear display of all terms
2. **Explicit Agreement**: Required checkbox confirmation
3. **Digital Signature**: Legally binding signature capture
4. **Timestamp**: Precise recording of when agreement was made
5. **Audit Trail**: Complete record of the signing process

## Usage Instructions

### For Employees
1. Navigate to your user profile
2. Click "Sign Joining Form" button
3. Read and agree to terms and conditions
4. Draw your signature in the signature pad
5. Click "Sign and Submit Joining Form"

### For HR/Management
1. Navigate to user management
2. Find users with pending signatures
3. Click "Sign Joining Form" in user actions
4. Complete the signature process on behalf of the employee
5. Monitor dashboard widget for pending signatures

## Migration Instructions

To add the e-signature fields to your database, run the following SQL:

```sql
-- Add e-signature fields to users table
ALTER TABLE "users1" ADD COLUMN "joining_form_signed_at" TIMESTAMP(3);
ALTER TABLE "users1" ADD COLUMN "joining_form_signed_by" TEXT;
ALTER TABLE "users1" ADD COLUMN "joining_form_signature" TEXT;
ALTER TABLE "users1" ADD COLUMN "joining_form_agreement" BOOLEAN NOT NULL DEFAULT false;
```

Or use Prisma migration:

```bash
npx prisma migrate dev --name add_joining_form_esignature
```

## Future Enhancements

1. **Bulk Signature**: Sign multiple forms at once
2. **Signature Templates**: Pre-defined signature styles
3. **Email Notifications**: Reminders for unsigned forms
4. **Advanced Validation**: Signature quality assessment
5. **Mobile App**: Native mobile signature capture
6. **Integration**: Connect with external e-signature services 