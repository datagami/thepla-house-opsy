export type Feature = 
  | "users.view"
  | "users.create"
  | "users.edit"
  | "users.delete"
  | "users.approve"
  | "users.assign_branch"
  | "users.manage"
  | "users.change_role"
  | "attendance.view"
  | "attendance.mark"
  | "attendance.edit"
  | "attendance.verify"
  | "attendance.report"
  | "branch.view"
  | "branch.create"
  | "branch.edit"
  | "branch.delete"
  | "branch.select"
  | "leave.view"
  | "leave.request"
  | "leave.approve"
  | "dashboard.view"
  | "dashboard.stats"
  | "employees.view"
  | "salary.edit"
  | "uniform.view"
  | "uniform.create"
  | "uniform.edit"
  | "uniform.delete"
  | "activity-logs.view";

type RolePermissions = {
  [key in Feature]: string[];
};

const permissions: RolePermissions = {
  // User Management
  "users.view": ["HR", "MANAGEMENT", "BRANCH_MANAGER"],
  "users.create": ["HR", "MANAGEMENT"],
  "users.edit": ["HR", "MANAGEMENT"],
  "users.delete": ["HR", "MANAGEMENT"],
  "users.approve": ["HR", "MANAGEMENT"],
  "users.assign_branch": ["HR", "MANAGEMENT"],
  "users.change_role": ["HR", "MANAGEMENT"],
  "users.manage": ["HR", "MANAGEMENT"],

  // Attendance Management
  "attendance.view": ["HR", "MANAGEMENT", "BRANCH_MANAGER", "EMPLOYEE"],
  "attendance.mark": ["BRANCH_MANAGER", "HR"],
  "attendance.edit": ["BRANCH_MANAGER", "HR"],
  "attendance.verify": ["HR", "MANAGEMENT"],
  "attendance.report": ["HR", "MANAGEMENT"],

  // Branch Management
  "branch.view": ["HR", "MANAGEMENT"],
  "branch.create": ["MANAGEMENT"],
  "branch.edit": ["MANAGEMENT"],
  "branch.delete": ["MANAGEMENT"],
  "branch.select": ["MANAGEMENT"],

  // Leave Management
  "leave.view": ["HR", "MANAGEMENT", "BRANCH_MANAGER", "EMPLOYEE"],
  "leave.request": ["EMPLOYEE"],
  "leave.approve": ["BRANCH_MANAGER", "HR"],

  // Dashboard
  "dashboard.view": ["HR", "MANAGEMENT", "BRANCH_MANAGER", "EMPLOYEE"],
  "dashboard.stats": ["HR", "MANAGEMENT", "BRANCH_MANAGER"],

  // Employees
  "employees.view": ["BRANCH_MANAGER", "HR", "MANAGEMENT"],

  // Salary
  "salary.edit": ["HR", "MANAGEMENT"],

  // Uniform Management
  "uniform.view": ["HR", "MANAGEMENT", "BRANCH_MANAGER"],
  "uniform.create": ["HR", "MANAGEMENT", "BRANCH_MANAGER"],
  "uniform.edit": ["HR", "MANAGEMENT", "BRANCH_MANAGER"],
  "uniform.delete": ["HR", "MANAGEMENT"],

  // Activity Logs
  "activity-logs.view": ["HR", "MANAGEMENT"],
};

export function hasAccess(userRole: string, feature: Feature): boolean {
  return permissions[feature].includes(userRole);
} 
