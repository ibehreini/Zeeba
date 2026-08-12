/**
 * Seeded local-only accounts for the docker/test-auth sign-in screen. Must
 * stay in sync with supabase/seed.sql, which is what actually creates these
 * auth.users rows (via `supabase db reset`) - this file only supplies the
 * email + label the picker UI shows.
 */
export type TestAccount = {
  email: string;
  name: string;
  description: string;
};

export const TEST_ACCOUNTS: readonly TestAccount[] = [
  { email: 'ava@zeeba.local', name: 'Ava Chen', description: 'Owns a closet styled by 3 stylists' },
  { email: 'blake@zeeba.local', name: 'Blake Nguyen', description: "Stylist on Ava's closet" },
  { email: 'casey@zeeba.local', name: 'Casey Patel', description: "Stylist on Ava's closet" },
  { email: 'drew@zeeba.local', name: 'Drew Sullivan', description: "Stylist on Ava's closet" },
  { email: 'emerson@zeeba.local', name: 'Emerson Vega', description: 'Stylist on 4 closets' },
  { email: 'finley@zeeba.local', name: 'Finley Ortiz', description: "Owns a closet, styled by Emerson" },
  { email: 'gray@zeeba.local', name: 'Gray Nakamura', description: "Owns a closet, styled by Emerson" },
  { email: 'harper@zeeba.local', name: 'Harper Diaz', description: "Owns a closet, styled by Emerson" },
  { email: 'indigo@zeeba.local', name: 'Indigo Reyes', description: "Owns a closet, styled by Emerson" },
];
