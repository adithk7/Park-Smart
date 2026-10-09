import { z } from 'zod';

export const registerAdminSchema = z.object({
  // Step 1: Admin Account
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Confirm password must be at least 8 characters'),

  // Step 2: Parking Space
  parkingAreaName: z.string().min(2, 'Parking area name must be at least 2 characters'),
  city: z.string().min(2, 'City is required'),
  address: z.string().min(3, 'Address is required'),
  venueType: z.enum(['TRANSIENT', 'RECURRING', 'BOTH']),
  siteTier: z.coerce.number().int().min(0).max(3),
  levels: z.coerce.number().int().min(1, 'At least 1 level is required').max(50, 'Max 50 levels supported'),
  totalSlots: z.coerce.number().int().min(1, 'Total slots must be at least 1').max(10000, 'Max 10,000 slots'),
  staffPassword: z.string().min(4, 'Staff password must be at least 4 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type RegisterAdminInput = z.infer<typeof registerAdminSchema>;
