"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Branch, User } from "@/models/models";

const userFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["EMPLOYEE", "BRANCH_MANAGER", "HR", "MANAGEMENT"]),
  branchId: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
});

interface UserProfileFormProps {
  user?: User;
  branches: Branch[];
  canEdit?: boolean;
}

export function UserProfileForm({ user, branches, canEdit = true }: UserProfileFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      role: user?.role || "EMPLOYEE",
      branchId: user?.branch?.id,
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof userFormSchema>) => {
    setIsLoading(true);
    try {
      const endpoint = user ? `/api/users/${user.id}` : "/api/users";
      const method = user ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
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
      toast.error("Failed to save user");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} disabled={!canEdit} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input {...field} type="email" disabled={!canEdit} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                disabled={!canEdit}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  <SelectItem value="BRANCH_MANAGER">Branch Manager</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                  <SelectItem value="MANAGEMENT">Management</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="branchId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Branch</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                disabled={!canEdit}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {(!user || canEdit) && (
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{user ? "New Password" : "Password"}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="password"
                    placeholder={user ? "Leave blank to keep current password" : ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {canEdit && (
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : user ? "Update User" : "Create User"}
          </Button>
        )}
      </form>
    </Form>
  );
} 