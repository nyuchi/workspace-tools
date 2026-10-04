/* Shared class strings for form controls, following the Mzizi component
   specs (mzizi_get_tokens componentSpecs): pill inputs and buttons, 48px
   minimum targets, 14px cards, 17px tabs, 7px checkboxes. Body copy uses
   foreground at 80% rather than --muted-foreground, which is 6.2:1 on the
   light base — short of AAA's 7:1 (the 80% ink is 9:1 light, 11:1 dark). */
export const label = "block text-body-sm font-medium text-foreground mb-1.5";
export const hint = "text-caption text-foreground/80";
export const input =
  "w-full h-12 rounded-full border border-border bg-input px-5 text-body text-foreground placeholder:text-foreground/55 " +
  "transition-colors duration-200 ease-soft hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
export const textarea = input.replace(
  "h-12 rounded-full",
  "min-h-24 rounded-[17px] py-3 leading-relaxed",
);
export const select = input + " appearance-none pr-12 cursor-pointer";
export const check =
  "h-5 w-5 rounded-[7px] accent-[var(--primary)] cursor-pointer";
export const card =
  "rounded-[14px] border border-border bg-card text-card-foreground";
export const body = "text-foreground/80";
