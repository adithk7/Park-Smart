import { z } from 'zod';

export const registerAdminSchema = z
  .object({
    // Step 1: Admin Account
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Confirm password must be at least 8 characters'),

    // Step 2: Parking Space
    parkingAreaName: z.string().min(2, 'Parking area name must be at least 2 characters'),
    city: z.string().min(2, 'City is required'),
    address: z.string().min(3, 'Address is required'),
    venueType: z.enum(['TRANSIENT', 'RECURRING', 'BOTH']).default('BOTH'),
    siteTier: z.coerce.number().int().min(0).max(3).default(2),
    levels: z.coerce.number().int().min(1, 'At least 1 level is required').max(50, 'Max 50 levels supported').default(1),
    totalSlots: z.coerce.number().int().min(1, 'Total slots must be at least 1').max(10000, 'Max 10,000 slots'),
    twoWheelerCapacity: z.coerce.number().int().min(0, 'Capacity cannot be negative'),
    fourWheelerCapacity: z.coerce.number().int().min(0, 'Capacity cannot be negative'),
    otherCapacity: z.coerce.number().int().min(0, 'Capacity cannot be negative').default(0),
    hourlyRate2W: z.coerce.number().min(0).default(15.0),
    hourlyRate4W: z.coerce.number().min(0).default(30.0),
    evChargingAvailable: z.boolean().default(false),
    evPointsCount: z.coerce.number().int().min(0).default(0),
    evHourlyRate: z.coerce.number().min(0).default(50.0),
    carWashAvailable: z.boolean().default(false),
    carWashRate: z.coerce.number().min(0).default(150.0),
    openingTime: z.string().default('00:00'),
    closingTime: z.string().default('23:59'),
    staffPassword: z.string().min(4, 'Staff password must be at least 4 characters'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine(
    (data) =>
      data.twoWheelerCapacity + data.fourWheelerCapacity + data.otherCapacity === data.totalSlots,
    {
      message:
        'Two-wheeler capacity + Four-wheeler capacity + Other capacity must equal Total capacity',
      path: ['totalSlots'],
    }
  );

export type RegisterAdminInput = z.infer<typeof registerAdminSchema>;
