'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { DateInput } from '@/components/ui/date-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2 } from 'lucide-react';

const salaryComponentSchema = z.object({
  name: z.string().min(1, 'Component name is required'),
  perAnnum: z.number().min(0, 'Per annum must be a positive number'),
  perMonth: z.number().min(0, 'Per month must be a positive number'),
});

const jobOfferFormSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    name: z.string().min(2, 'Name must be at least 2 characters'),
    designation: z.string().min(2, 'Designation must be at least 2 characters'),
    role: z.enum(['EMPLOYEE', 'BRANCH_MANAGER', 'HR', 'MANAGEMENT', 'SELF_ATTENDANCE']),
    departmentId: z.string().min(1, 'Department is required'),
    totalSalary: z.number().min(0, 'Total salary must be a positive number'),
    salaryComponents: z.array(salaryComponentSchema).min(1, 'At least one salary component is required'),
    joiningDate: z.date({
      required_error: 'Joining date is required',
    }),
    expiresAt: z.date().optional(),
    foodAndStayProvided: z.boolean().default(false),
    halfDays: z.number().int().min(0).default(4),
    weekOff: z.number().int().min(0).default(2),
    notes: z.string().optional(),
  })
  .refine(
    (data) => {
      const totalComponents = data.salaryComponents.reduce(
        (sum, comp) => sum + comp.perAnnum,
        0
      );
      return Math.abs(totalComponents - data.totalSalary) < 1; // Allow small rounding differences
    },
    {
      message: 'Sum of all salary components should equal Total Cost to Company',
      path: ['totalSalary'],
    }
  );

interface Department {
  id: string;
  name: string;
}

interface JobOfferFormProps {
  departments: Department[];
  jobOffer?: any; // For editing
}

export function JobOfferForm({
  departments,
  jobOffer,
}: JobOfferFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof jobOfferFormSchema>>({
    resolver: zodResolver(jobOfferFormSchema),
    defaultValues: {
      title: jobOffer?.user?.title || '',
      name: jobOffer?.name || '',
      designation: jobOffer?.designation || '',
      role: (jobOffer?.user?.role as 'EMPLOYEE' | 'BRANCH_MANAGER' | 'HR' | 'MANAGEMENT' | 'SELF_ATTENDANCE') || 'EMPLOYEE',
      departmentId: jobOffer?.departmentId || '',
      totalSalary: jobOffer?.totalSalary || 0,
      salaryComponents: jobOffer?.salaryComponents
        ? (Array.isArray(jobOffer.salaryComponents)
            ? jobOffer.salaryComponents
            : [])
        : jobOffer?.basicPerAnnum
          ? [
              {
                name: 'Basic',
                perAnnum: jobOffer.basicPerAnnum,
                perMonth: jobOffer.basicPerMonth || Math.round(jobOffer.basicPerAnnum / 12),
              },
              ...(jobOffer.otherAllowancesPerAnnum
                ? [
                    {
                      name: 'Other Allowances',
                      perAnnum: jobOffer.otherAllowancesPerAnnum,
                      perMonth: jobOffer.otherAllowancesPerMonth || Math.round(jobOffer.otherAllowancesPerAnnum / 12),
                    },
                  ]
                : []),
            ]
          : [
              { name: 'Basic', perAnnum: 0, perMonth: 0 },
              { name: 'Other Allowances', perAnnum: 0, perMonth: 0 },
            ],
      joiningDate: jobOffer?.joiningDate
        ? new Date(jobOffer.joiningDate)
        : new Date(),
      expiresAt: jobOffer?.expiresAt
        ? new Date(jobOffer.expiresAt)
        : undefined,
      foodAndStayProvided: jobOffer?.foodAndStayProvided ?? false,
      halfDays: jobOffer?.halfDays ?? 4,
      weekOff: jobOffer?.weekOff ?? 2,
      notes: jobOffer?.notes || '',
    },
  });

  // Watch salary components and total salary
  const salaryComponents = form.watch('salaryComponents');
  const prevComponentsRef = useRef<string>('');

  // Auto-calculate total from components
  useEffect(() => {
    if (!salaryComponents || salaryComponents.length === 0) return;
    
    const componentsKey = salaryComponents.map((c) => c.perAnnum).join(',');
    if (prevComponentsRef.current === componentsKey) return;
    prevComponentsRef.current = componentsKey;
    
    const total = salaryComponents.reduce((sum, comp) => sum + (comp.perAnnum || 0), 0);
    const currentTotal = form.getValues('totalSalary');
    if (total > 0 && Math.abs(total - currentTotal) > 1) {
      form.setValue('totalSalary', total, { shouldValidate: false });
    }
  }, [salaryComponents, form]);

  const addSalaryComponent = () => {
    const currentComponents = form.getValues('salaryComponents');
    form.setValue('salaryComponents', [
      ...currentComponents,
      { name: '', perAnnum: 0, perMonth: 0 },
    ]);
  };

  const removeSalaryComponent = (index: number) => {
    const currentComponents = form.getValues('salaryComponents');
    form.setValue(
      'salaryComponents',
      currentComponents.filter((_, i) => i !== index)
    );
  };

  const onSubmit = async (values: z.infer<typeof jobOfferFormSchema>) => {
    setIsLoading(true);
    try {
      const endpoint = jobOffer
        ? `/api/job-offers/${jobOffer.id}`
        : '/api/job-offers';
      const method = jobOffer ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values,
          departmentId: values.departmentId || null,
          expiresAt: values.expiresAt ? values.expiresAt.toISOString() : null,
          joiningDate: values.joiningDate.toISOString(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save job offer');
      }

      toast.success(
        jobOffer
          ? 'Job offer updated successfully'
          : 'Job offer created successfully'
      );
      router.push('/job-offers');
      router.refresh();
    } catch (error) {
      console.error('Error saving job offer:', error);
      toast.error(
        error instanceof Error ? error.message : 'Error saving job offer'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Mr, Ms, Mrs" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter candidate name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="designation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Designation *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Waiter / Captain"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employment Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
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
                        <SelectItem value="SELF_ATTENDANCE">Self Attendance</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="departmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a department" />
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="joiningDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Joining Date *</FormLabel>
                    <FormControl>
                      <DateInput
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiresAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Offer Expires At</FormLabel>
                    <FormControl>
                      <DateInput
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Salary Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="totalSalary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Cost to Company (Per Annum) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="e.g., 204000"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value) || 0)
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Total annual salary (CTC) - Auto-calculated from components below
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Salary Components</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSalaryComponent}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Component
                </Button>
              </div>

              {salaryComponents.map((component, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg"
                >
                  <FormField
                    control={form.control}
                    name={`salaryComponents.${index}.name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Component Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Basic, HRA, Other Allowances"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`salaryComponents.${index}.perAnnum`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Per Annum *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
                            {...field}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              field.onChange(value);
                              // Auto-calculate per month
                              const currentComponents = form.getValues('salaryComponents');
                              currentComponents[index].perMonth = Math.round(value / 12);
                              form.setValue('salaryComponents', currentComponents);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`salaryComponents.${index}.perMonth`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Per Month *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Auto-calculated"
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value) || 0)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSalaryComponent(index)}
                      className="text-red-600 hover:text-red-700"
                      disabled={salaryComponents.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Benefits & Additional Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="foodAndStayProvided"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Food & Accommodation Provided</FormLabel>
                    <FormDescription>
                      Check this if food and accommodation will be provided to the employee
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="halfDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Half Days (per month)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      Number of half days allowed per month
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="weekOff"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Week Off (per month)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      Number of week offs allowed per month
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes</FormLabel>
                  <FormControl>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Any additional notes or terms..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading
              ? 'Saving...'
              : jobOffer
                ? 'Update Job Offer'
                : 'Create Job Offer'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
