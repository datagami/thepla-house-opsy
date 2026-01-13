"use client";

import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {zodResolver} from "@hookform/resolvers/zod";
import {useForm} from "react-hook-form";
import * as z from "zod";
import {Button} from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {Input} from "@/components/ui/input";
import {Switch} from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {toast} from "sonner";
import {Branch, User} from "@/models/models";
import {UserImageUpload} from './user-image-upload';
import {DateInput} from "@/components/ui/date-input";
import {PasswordDisplayDialog} from './password-display-dialog';

const userFormSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["EMPLOYEE", "BRANCH_MANAGER", "HR", "MANAGEMENT", "SELF_ATTENDANCE"]),
  branch: z.string().optional(),
  departmentId: z.string().min(1, "Department is required"),
  mobileNo: z.string().min(10, "Mobile number must be at least 10 digits"),
  doj: z.date({
    required_error: "Date of joining is required",
  }),
  dob: z.date({
    required_error: "Date of birth is required",
  }),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  panNo: z.string().min(10, "PAN number must be 10 characters"),
  aadharNo: z.string().min(12, "Aadhar number must be 12 digits"),
  salary: z.number().min(0, "Salary must be a positive number"),
  bankAccountNo: z.string().min(9, "Account number must be at least 9 digits").optional(),
  bankIfscCode: z
    .string()
    .regex(
      /^[A-Z]{4}0[A-Z0-9]{6}$/,
      "IFSC code must be valid (e.g., HDFC0123456)"
    )
    .optional(),
  references: z.array(
    z.object({
      name: z.string().min(2, "Reference name is required"),
      contactNo: z.string().min(10, "Contact number must be at least 10 digits"),
    })
  ).min(1, "At least one reference is required"),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal('')),
  referredById: z.string().optional(),
  hasWeeklyOff: z.boolean().optional(),
  weeklyOffType: z.enum(["FIXED", "FLEXIBLE"]).optional().nullable(),
  weeklyOffDay: z.number().min(0).max(6).optional().nullable(),
});

interface UserProfileFormProps {
  user?: User;
  branches: Branch[];
  canEdit?: boolean;
}

interface Department {
  id: string;
  name: string;
  description?: string | null;
}

export function UserProfileForm({user, branches, canEdit = true}: UserProfileFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; email?: string | null }>>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [referrerOpen, setReferrerOpen] = useState(false);
  const [referrerQuery, setReferrerQuery] = useState("");
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<string>("");
  const [createdUserName, setCreatedUserName] = useState<string>("");
  const [createdUserEmail, setCreatedUserEmail] = useState<string>("");
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [resetPassword, setResetPassword] = useState<string>("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const form = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      title: user?.title || "",
      name: user?.name || "",
      email: user?.email || "",
      role: user?.role || "EMPLOYEE",
      branch: user?.branch?.id || "",
      departmentId: user?.department?.id || "",
      mobileNo: user?.mobileNo || "",
      doj: user?.doj ? new Date(user.doj) : undefined,
      dob: user?.dob ? new Date(user.dob) : undefined,
      gender: (user?.gender as 'MALE' | 'FEMALE' | 'OTHER' | undefined) || "MALE",
      panNo: user?.panNo || "",
      aadharNo: user?.aadharNo || "",
      salary: user?.salary || 0,
      bankAccountNo: user?.bankAccountNo || "",
      bankIfscCode: user?.bankIfscCode || "",
      references: user?.references?.length
        ? user.references.map(ref => ({
          name: ref.name,
          contactNo: ref.contactNo
        }))
        : [{name: "", contactNo: ""}],
      password: "",
      referredById: (
        user as User & {
          referralsReceived?: Array<{ referrerId: string }>
        }
      )?.referralsReceived?.[0]?.referrerId || undefined,
      hasWeeklyOff: (user as User & { hasWeeklyOff?: boolean })?.hasWeeklyOff || false,
      weeklyOffType: (user as User & { weeklyOffType?: string | null })?.weeklyOffType || null,
      weeklyOffDay: (user as User & { weeklyOffDay?: number | null })?.weeklyOffDay || null,
    },
  });

  // Helper function to check if user is within referral window (30 days from DOJ)
  const isWithinReferralWindow = (doj: Date | null | undefined): boolean => {
    if (!doj) return false;
    const today = new Date();
    const dojDate = new Date(doj);
    const daysSinceDoj = Math.floor((today.getTime() - dojDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceDoj <= 30;
  };

  // Watch DOJ field to update referral disabled state dynamically
  const currentDoj = form.watch("doj");
  const dojToCheck = currentDoj || user?.doj;

  // Check if referral field should be disabled
  const isReferralDisabled = user ? !isWithinReferralWindow(dojToCheck) : false;
  const referralHelperText = user 
    ? (!dojToCheck 
        ? "Date of Joining must be set before adding a referral"
        : !isWithinReferralWindow(dojToCheck)
        ? "Referrals can only be added within one month of joining date"
        : undefined)
    : undefined;

  // Load departments for dropdown
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await fetch('/api/departments');
        if (res.ok) {
          const data: Department[] = await res.json();
          setDepartments(data);
        }
      } catch {
        // ignore
      }
    };
    loadDepartments();
  }, []);

  // Load active employees for referrer selection (lightweight list)
  useEffect(() => {
    const loadEmployees = async () => {
      try {
          const res = await fetch('/api/users?active=true');
        if (res.ok) {
          const data: Array<{ id: string; name: string; email?: string | null }> = await res.json();
          setEmployees(data.map((u) => ({ id: u.id, name: u.name, email: u.email })));
        }
      } catch {
        // ignore
      }
    };
    // Load employees for both creating and editing users
    loadEmployees();
  }, [user]);

  const onSubmit = async (values: z.infer<typeof userFormSchema>) => {
    setIsLoading(true);
    try {
      const endpoint = user ? `/api/users/${user.id}` : "/api/users";
      const method = user ? "PUT" : "POST";

      const submitData: Record<string, unknown> = {
        ...values,
        ...(values.password ? {password: values.password} : {}),
        branchId: values.branch === "null" ? null : values.branch,
      };
      delete submitData.branch;
      // Don't send referredById if referral is disabled (past 1-month window or no DOJ)
      if (isReferralDisabled || !('referredById' in submitData) || submitData.referredById === "null" || submitData.referredById === "") {
        delete (submitData as { referredById?: unknown }).referredById;
      }
      if (submitData.departmentId === "null" || submitData.departmentId === "") delete submitData.departmentId;

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save user");
      }

      const responseData = await response.json();

      if (!user && responseData.password) {
        // User was created, show password dialog
        setCreatedPassword(responseData.password);
        setCreatedUserName(responseData.name || "");
        setCreatedUserEmail(responseData.email || "");
        setShowPasswordDialog(true);
      } else {
        toast.success(user ? "User updated successfully" : "User created successfully");
        router.refresh();
        if (!user) {
          router.push("/users");
        }
      }
    } catch (error) {
      console.error("Error saving user:", error);
      toast.error(error instanceof Error ? error.message : "Error saving user");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user?.id) {
      toast.error("User ID is required");
      return;
    }

    setIsResettingPassword(true);
    try {
      const response = await fetch(`/api/users/${user.id}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to reset password");
      }

      const responseData = await response.json();
      
      if (responseData.password) {
        setResetPassword(responseData.password);
        setShowResetPasswordDialog(true);
        toast.success("Password reset successfully");
      } else {
        throw new Error("Password not returned from server");
      }
    } catch (error) {
      console.error("Error resetting password:", error);
      toast.error(error instanceof Error ? error.message : "Failed to reset password");
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <>
    <Form {...form}>
      <div className="mb-8">
        <UserImageUpload
          userId={user?.id || ''}
          currentImage={user?.image}
          onImageUpdate={(imageUrl) => {
            if (user) {
              user.image = imageUrl;
            }
          }}
        />
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="title"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={!canEdit}/>
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={!canEdit}/>
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" disabled={!canEdit}/>
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}
            />

            {(!user || canEdit) && (
              <FormField
                control={form.control}
                name="password"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>{user ? "New Password" : "Password"}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder={user ? "Leave blank to keep current password" : "Leave blank to auto-generate (name@1234)"}
                        disabled={!canEdit}
                      />
                    </FormControl>
                    <FormMessage/>
                  </FormItem>
                )}
              />
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Employment Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="role"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={!canEdit}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role"/>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="EMPLOYEE">Employee</SelectItem>
                      <SelectItem value="BRANCH_MANAGER">Branch Manager</SelectItem>
                      <SelectItem value="HR">HR</SelectItem>
                      <SelectItem value="MANAGEMENT">Management</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage/>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="branch"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Branch</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={!canEdit}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a branch"/>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {/* unset the value if the branch is none */}
                      <SelectItem key="none" value="null">None</SelectItem>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage/>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="departmentId"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={!canEdit}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a department"/>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage/>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="salary"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Salary</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      disabled={!canEdit}
                      onChange={e => field.onChange(parseFloat(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}
            />

            <FormField
              disabled={!canEdit}
              control={form.control}
              name="doj"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Date of Joining</FormLabel>
                  <FormControl>
                    <DateInput onChange={field.onChange} value={field.value}/>
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mobileNo"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Mobile Number</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="tel"
                      disabled={!canEdit}
                      maxLength={10}
                      pattern="\d*"
                      inputMode="numeric"
                    />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="referredById"
              render={({ field }) => {
                const selected = employees.find(e => e.id === field.value);
                const filtered = referrerQuery
                  ? employees.filter(e =>
                      (e.name + " " + (e.email || "")).toLowerCase().includes(referrerQuery.toLowerCase())
                    )
                  : employees;
                return (
                  <FormItem>
                    <FormLabel>Referrer (Existing Employee)</FormLabel>
                    <Popover open={referrerOpen} onOpenChange={setReferrerOpen}>
                      <PopoverTrigger asChild>
                        <Button 
                          type="button" 
                          variant="outline" 
                          role="combobox" 
                          aria-expanded={referrerOpen} 
                          disabled={!canEdit || isReferralDisabled} 
                          className="w-full justify-between"
                        >
                          {selected ? `${selected.name}${selected.email ? ` (${selected.email})` : ''}` : "Select a referrer (optional)"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-2">
                        <div className="space-y-2">
                          <Input
                            placeholder="Search employees..."
                            value={referrerQuery}
                            onChange={(e) => setReferrerQuery(e.target.value)}
                            disabled={isReferralDisabled}
                          />
                          <div className="max-h-60 overflow-auto rounded-md border">
                            <button
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                              onClick={() => {
                                field.onChange(undefined);
                                setReferrerOpen(false);
                              }}
                              disabled={isReferralDisabled}
                            >
                              None
                            </button>
                            {filtered.map(emp => (
                              <button
                                key={emp.id}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                                onClick={() => {
                                  field.onChange(emp.id);
                                  setReferrerOpen(false);
                                }}
                                disabled={isReferralDisabled}
                              >
                                {emp.name}{emp.email ? ` (${emp.email})` : ''}
                              </button>
                            ))}
                            {filtered.length === 0 && (
                              <div className="px-3 py-2 text-sm text-muted-foreground">No results</div>
                            )}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                    {referralHelperText && (
                      <p className="text-sm text-muted-foreground">{referralHelperText}</p>
                    )}
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              disabled={!canEdit}
              name="dob"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Date of Birth</FormLabel>
                  <FormControl>
                    <DateInput onChange={field.onChange} value={field.value}/>
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gender"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={!canEdit}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender"/>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage/>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="panNo"
              render={({field}) => (
                <FormItem>
                  <FormLabel>PAN Number</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="ABCDE1234F"
                      disabled={!canEdit}
                      maxLength={10}
                      className="uppercase"
                    />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="aadharNo"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Aadhar Number</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="1234 5678 9012"
                      disabled={!canEdit}
                      maxLength={12}
                      pattern="\d*"
                      inputMode="numeric"
                    />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Bank Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="bankAccountNo"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Bank Account Number</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter account number"
                      disabled={!canEdit}
                      type="text"
                      inputMode="numeric"
                      pattern="\d*"
                    />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bankIfscCode"
              render={({field}) => (
                <FormItem>
                  <FormLabel>IFSC Code</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="HDFC0123456"
                      disabled={!canEdit}
                      className="uppercase"
                      maxLength={11}
                    />
                  </FormControl>
                  <FormMessage/>
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Weekly Off Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="hasWeeklyOff"
              render={({field}) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Has Weekly Off</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Enable weekly off for this employee
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={!canEdit}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            {form.watch("hasWeeklyOff") && (
              <>
                <FormField
                  control={form.control}
                  name="weeklyOffType"
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>Weekly Off Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                        disabled={!canEdit}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type"/>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="FIXED">Fixed (Same day each week)</SelectItem>
                          <SelectItem value="FLEXIBLE">Flexible (Employee chooses)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage/>
                    </FormItem>
                  )}
                />
                {form.watch("weeklyOffType") === "FIXED" && (
                  <FormField
                    control={form.control}
                    name="weeklyOffDay"
                    render={({field}) => (
                      <FormItem>
                        <FormLabel>Weekly Off Day</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          value={field.value?.toString() || undefined}
                          disabled={!canEdit}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select day"/>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="0">Sunday</SelectItem>
                            <SelectItem value="1">Monday</SelectItem>
                            <SelectItem value="2">Tuesday</SelectItem>
                            <SelectItem value="3">Wednesday</SelectItem>
                            <SelectItem value="4">Thursday</SelectItem>
                            <SelectItem value="5">Friday</SelectItem>
                            <SelectItem value="6">Saturday</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage/>
                      </FormItem>
                    )}
                  />
                )}
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">References</h3>
          {form.watch("references").map((_, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-md">
              <FormField
                control={form.control}
                name={`references.${index}.name`}
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Reference Name {index + 1}</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={!canEdit}/>
                    </FormControl>
                    <FormMessage/>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`references.${index}.contactNo`}
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Contact Number</FormLabel>
                    <FormControl>
                      <Input {...field} type="tel" disabled={!canEdit}/>
                    </FormControl>
                    <FormMessage/>
                  </FormItem>
                )}
              />
            </div>
          ))}
          {canEdit && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const currentRefs = form.getValues("references");
                if (currentRefs.length < 2) {
                  form.setValue("references", [
                    ...currentRefs,
                    {name: "", contactNo: ""},
                  ]);
                }
              }}
              disabled={form.watch("references").length >= 2}
            >
              Add Reference
            </Button>
          )}
        </div>

        {canEdit && (
          <div className="flex gap-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : user ? "Update User" : "Create User"}
            </Button>
            
            {user && (
              <Button
                type="button"
                variant="outline"
                onClick={handleResetPassword}
                disabled={isResettingPassword || isLoading}
              >
                {isResettingPassword ? "Resetting..." : "Reset Password"}
              </Button>
            )}
            
            {user && !user.joiningFormSignedAt && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  window.open(`/users/${user.id}/joining-form-signature`, '_blank');
                }}
              >
                Sign Joining Form
              </Button>
            )}
            
            {user && user.joiningFormSignedAt && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <span>✓</span>
                <span>Joining form signed on {new Date(user.joiningFormSignedAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        )}
      </form>
    </Form>
    <PasswordDisplayDialog
      isOpen={showPasswordDialog}
      onClose={() => {
        setShowPasswordDialog(false);
        setCreatedPassword("");
        toast.success("User created successfully");
        router.refresh();
        router.push("/users");
      }}
      password={createdPassword}
      userName={createdUserName}
      userEmail={createdUserEmail}
      title="User Password"
    />
    <PasswordDisplayDialog
      isOpen={showResetPasswordDialog}
      onClose={() => {
        setShowResetPasswordDialog(false);
        setResetPassword("");
        router.refresh();
      }}
      password={resetPassword}
      userName={user?.name || ""}
      userEmail={user?.email || ""}
      title="Reset Password"
    />
    </>
  );
} 
