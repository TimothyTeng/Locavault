/** A medication dose schedule (opt-in reminders v1, DESIGN.md §4/§6). */
export type DoseSchedule = {
  id: string;
  itemId: string;
  userId: string;
  timesPerDay: number;
  startDate: Date;
  endDate: Date | null; // null = ongoing/indefinite
  active: boolean;
  createdAt: Date | null;
};

/** A schedule joined with its item/store context + today's progress, for the
 *  reminders surface. */
export type DoseScheduleView = DoseSchedule & {
  itemName: string;
  storeId: string;
  storeName: string;
  quantity: number;
  unit: string | null;
  takenToday: number;
  dueCount: number;
};

/** A medication item surfaced on the reminders page (refill / expiring). */
export type ReminderItem = {
  id: string;
  name: string;
  storeId: string;
  storeName: string;
  quantity: number;
  unit: string | null;
  runoutDays: number | null;
  expiryDays: number | null;
};

/** The whole /reminders payload. */
export type RemindersData = {
  doses: DoseScheduleView[];
  refill: ReminderItem[];
  expiring: ReminderItem[];
  dueCount: number;
};
