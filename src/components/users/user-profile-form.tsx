"use client";

import {useState} from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {toast} from "sonner";
import {Branch, User} from "@/models/models";
import {UserImageUpload} from './user-image-upload';
import {DateInput} from "@/components/ui/date-input";

const userFormSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["EMPLOYEE", "BRANCH_MANAGER", "HR", "MANAGEMENT"]),
  branch: z.string().optional(),
  department: z.string().min(2, "Department is required"),
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
});

interface UserProfileFormProps {
  user?: User;
  branches: Branch[];
  canEdit?: boolean;
}

export function UserProfileForm({user, branches, canEdit = true}: UserProfileFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      title: user?.title || "",
      name: user?.name || "",
      email: user?.email || "",
      role: user?.role || "EMPLOYEE",
      branch: user?.branch?.id || "",
      department: user?.department || "",
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
    },
  });

  const onSubmit = async (values: z.infer<typeof userFormSchema>) => {
    setIsLoading(true);
    try {
      const endpoint = user ? `/api/users/${user.id}` : "/api/users";
      const method = user ? "PUT" : "POST";

      const submitData = {
        ...values,
        ...(values.password ? {password: values.password} : {}),
        branchId: values.branch === "null" ? null : values.branch,
      };
      delete submitData.branch;

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        throw new Error("Failed to save user");
      }

      toast.success(user ? "User updated successfully" : "User created successfully");
      router.refresh();
      if (!user) {
        router.push("/users");
      }
    } catch (error) {
      console.error("Error saving user:", error);
      toast.error("Error saving user");
    } finally {
      setIsLoading(false);
    }
  };

  return (
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
                        placeholder={user ? "Leave blank to keep current password" : ""}
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
              name="department"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={!canEdit}/>
                  </FormControl>
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
  );
} 
