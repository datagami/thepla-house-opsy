# Cloud Kitchen HRMS Project – Attendance & Leave Tracker

## Overview
Develop a Next.js application using Auth.js for authentication and Prisma as the ORM for managing HRMS operations in a cloud kitchen. The primary feature is an Attendance module with the following capabilities:
- **Attendance Tracking:** Mark daily attendance via a Calendar-like UI built with shadcn UI components.
- **Overtime & Half Days:** Allow marking overtime hours and half-day entries.
- **Time-Based Locking:** Attendance cannot be updated after 8pm IST by default. If a branch manager misses the update, they must submit an unlock request.
- **Unlock Requests:** Provide functionality to unlock a specific day, including logging all such requests.
- **HR Verification:** After attendances are locked, HR must verify and confirm the records within 24 hours.
- **Leave Tracker:** Enable employees to submit leave requests, with HR/top management reviewing them.

## Role-Based Data Access
- **Top-Level Management & HR:** Can view and manage all user data.
- **Branch Managers:** Can view data only for their own branch.
- **Employees:** Can see only their own attendance and leave records.

## Technology Stack
- **Frontend:** Next.js with shadcn UI and related libraries for a consistent, responsive UI
- **Authentication:** Auth.js
- **Database & ORM:** Prisma
- **UI Components:** Calendar UI for attendance tracking built using shadcn UI components

## Key Requirements
1. **User Roles & Access Control**
   - Implement strict role-based permissions.
   - Validate endpoints and UI components to ensure data isolation.
2. **Attendance Module**
   - Calendar-like UI for marking daily attendance, built with shadcn UI components.
   - Options for overtime, half days, and normal entries.
   - Attendance updates locked after 8pm IST unless an unlock request is approved.
   - **HR Verification:** HR must verify locked attendance records within 24 hours after the lock.
3. **Unlock Request Feature**
   - Branch managers can submit unlock requests.
   - Admin interface for management/HR to review and unlock specific days.
   - Maintain a log of all unlock requests.
4. **Leave Tracker Module**
   - Allow employees to submit leave requests.
   - HR/Management can approve or reject these requests.
   - Provide a history view for all leave activities.
5. **Security**
   - Ensure that data access is strictly controlled based on user roles.
   - Use Auth.js for secure authentication.

---

### Updated Sample Rules File (cursor.rules.json)

```json
{
  "project": "Cloud Kitchen HRMS",
  "modules": {
    "attendance": {
      "ui": "calendar using shadcn UI components",
      "features": [
        "daily attendance marking",
        "overtime support",
        "half-day recording",
        "automatic lock after 8pm IST",
        "HR verification of locked attendances within 24 hours",
        "unlock request mechanism",
        "unlock request logs"
      ]
    },
    "leaveTracker": {
      "features": [
        "employee leave request submission",
        "HR/Management review and approval",
        "leave request history tracking"
      ]
    }
  },
  "authentication": {
    "library": "auth.js",
    "roleBasedAccess": {
      "managementHR": "access all data",
      "branchManager": "access data for assigned branch only",
      "employee": "access self data only"
    }
  },
  "database": {
    "orm": "prisma",
    "schemaPath": "./prisma/schema.prisma"
  },
  "uiLibrary": {
    "name": "shadcn UI",
    "relatedLibraries": ["Tailwind CSS", "Radix UI"]
  },
  "codingStandards": {
    "eslint": {
      "rules": {
        "semi": ["error", "always"],
        "quotes": ["error", "single"],
        "indent": ["error", 2],
        "max-len": ["error", 120],
        "camelcase": ["error", { "properties": "always" }]
      }
    },
    "prettier": true
  },
  "documentation": {
    "requirements": "All code must be documented with inline comments and external documentation where needed. Use a consistent commit message format."
  }
}
