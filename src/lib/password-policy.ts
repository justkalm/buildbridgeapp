// src/lib/password-policy.ts
//
// The single source of truth for "is this an acceptable new password",
// used by both signup routes and both reset-password routes. Before this
// existed, each of those four routes had its own inline
// `z.string().min(8, ...)`, which is how rules quietly diverge.
//
// What it enforces, and why each piece:
//
// 1. Length 10–200 (numbers live in src/lib/password-rules.ts so the
//    client pages can import them without pulling this file's list and
//    zod into the browser bundle).
//
// 2. Not a common password. Length rules alone don't stop the passwords
//    real attackers actually try first — "password@123" is 12 characters.
//    COMMON_PASSWORDS below is a hand-picked list of a few hundred of the
//    most-used passwords worldwide, plus India-typical patterns
//    ("india@123", "jaihind", common first names, cricket, deities) and
//    site-specific ones ("buildbridge", "kalm123") — the site name is the
//    first thing anyone guessing a password on this site would try.
//
//    The check isn't just an exact lookup. Most weak passwords are a
//    common word dressed up with a year or "@123" to satisfy length/symbol
//    rules, so we also strip leading/trailing digits and symbols, undo
//    basic leetspeak (p@ssw0rd → password), and reject if what's left —
//    the "core" — is on the list and the stripped decoration was short
//    (≤ 8 chars; see MAX_DECORATION_LENGTH). That catches "Password@2026",
//    "kalm@12345", "Mumbai@1234" and so on without needing every variant
//    listed. It deliberately does NOT reject a common word buried inside a
//    longer passphrase ("my dragon eats paneer") — the core there isn't a
//    list entry, and long passphrases are exactly what we want people to
//    use.
//
// 3. Not your own email, or its local part (the bit before @), including
//    the same dressed-up variants as above. Checked where the email is
//    known: from the request body on signup, from the DB row on reset.
//
// This is NOT a substitute for a breached-password check (e.g. the
// HaveIBeenPwned k-anonymity API) — that would catch far more, but adds an
// external network dependency to signup. Reasonable next step if this
// ever needs tightening.

import { z } from 'zod';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '@/lib/password-rules';

export { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH };

// Lowercased. Short entries (under the min length) are still useful here:
// they're matched as the "core" of a longer password — "dragon" catches
// "Dragon@2026". Whitespace-separated for compactness; order is loose
// grouping only, not ranking.
const COMMON_PASSWORD_LIST = `
password passw0rd p@ssw0rd p@ssword pass password1 password12 password123
password1234 password@123 password@1234 password#123 password!123
password123! passwordpassword mypassword newpassword yourpassword
secret secret123 letmein letmein123 welcome welcome1 welcome123
welcome@123 welcomeback admin admin123 admin@123 administrator root toor
changeme changeme123 default guest user user123 login login123 test
test123 test@123 testing testing123 demo demo123 temp temp123 temppass

123456 1234567 12345678 123456789 1234567890 12345678910 0123456789
0987654321 9876543210 987654321 1111111111 0000000000 1212121212
1122334455 1234512345 1231231231 1234554321 123123123 112233 121212
123321 654321 666666 696969 777777 888888 999999 111111 000000 123123
147258369 159753 159357 741852963 789456123 147852369 11223344 12341234
abc123 abcd1234 abc12345 abcdef abcdefgh abcdefghij abcdefg123 a1b2c3d4
a1b2c3d4e5 1q2w3e4r 1q2w3e4r5t 1qaz2wsx 1qaz2wsx3edc zaq12wsx zaq1zaq1
qwerty qwerty1 qwerty12 qwerty123 qwerty1234 qwertyuiop qwertyui qwerty@123
qwe123 qweasd qweasdzxc asdfgh asdfghjkl asdf1234 asdfasdf zxcvbnm
zxcvbnm123 azerty asdasd asd123 qazwsx qazwsxedc mnbvcxz poiuytrewq
iloveyou iloveyou1 iloveyou123 loveyou lovely loveme love123 mylove
sunshine princess princess1 dragon monkey shadow master master123
football baseball basketball soccer hockey superman batman spiderman
starwars pokemon naruto freedom whatever trustno1 hello hello123
hellohello hello@123 hunter hunter2 ranger buster tigger charlie
jordan jordan23 michael jennifer thomas robert daniel matthew andrew
joshua ashley jessica amanda nicole george computer internet
cheese cookie chocolate banana orange pepper ginger summer winter
flower secret666 killer silver golden diamond blessed blessing
jesus christ faith heaven angel angels friends family forever
maggie buddy sophie charlie1 purple yellow garfield liverpool arsenal
chelsea manchester barcelona realmadrid mustang ferrari mercedes
harley corvette matrix access access14 zxcasdqwe passpass pass1234
pass@123 pass@1234 nothing nopassword password! qwerty! asdf!

india india123 india@123 india@1234 india1947 india@1947 jaihind
jaihind123 jaihind@123 bharat bharat123 bharat@123 hindustan hindustan123
mumbai mumbai123 mumbai@123 delhi delhi123 delhi@123 newdelhi bangalore
bengaluru bangalore123 chennai chennai123 kolkata hyderabad pune pune123
ahmedabad jaipur lucknow kerala punjab gujarat
krishna krishna123 krishna@123 radhekrishna harekrishna ganesh ganesha
ganesh123 ganpati ganpatibappa shiva shiva123 omnamahshivaya mahadev
harharmahadev jaishreeram jaishriram sriram shreeram ram123 hanuman
jaihanuman saibaba omsairam sairam durga lakshmi saraswati balaji
jaimatadi waheguru satnam allah bismillah786 786786 7867861 khwaja
sachin sachin123 tendulkar sachin10 dhoni dhoni07 msdhoni virat
viratkohli kohli18 rohit rohitsharma cricket cricket123 ipl2024 csk
chennaisuperkings mumbaiindians rcb rcb18 esalanamdu bollywood
shahrukh salmankhan srk amitabh
rahul rahul123 rahul@123 amit amit123 priya priya123 pooja pooja123
neha neha123 anjali sneha deepak sandeep suresh ramesh mahesh rajesh
vijay ajay sanjay manoj sunil anil vikas vishal rohan arjun aditya
akash abhishek ankit ankita nikhil kavita sunita rekha geeta sita
ravi kumar singh sharma verma gupta patel shah khan reddy nair iyer
mummy papa mummypapa mom123 mother father babu baby123 sweetheart
jaanu jaan sweety cutie chotu munna pinky bittu golu sonu monu
chiku honey honey123 love@123 iloveindia iloveu
airtel jio jio4g vodafone bsnl reliance tata infosys wipro
flipkart paytm phonepe gpay swiggy zomato
qwerty@1234 abc@123 abc@1234 asdf@123 admin@1234 test@1234 user@123
mypass mypass123 mypassword123 pass@word password@1 password@12

buildbridge buildbridge1 buildbridge123 buildbridge@123 build@123
build123 builder builder123 builders construction construction123
contractor contractor123 contractors developer developer123 developers
kalm kalm123 kalm@123 kalm1234 kalm@1234 kalmkalm kalmops kalmbuild
kalmapp kalmindia realestate property property123 project project123
cement concrete bricks architect engineer engineer123 civil civil123
site site123 tender tender123 housing homes infra infra123
`;

export const COMMON_PASSWORDS: ReadonlySet<string> = new Set(
  COMMON_PASSWORD_LIST.split(/\s+/).filter(Boolean)
);

const LEET_MAP: Record<string, string> = {
  '@': 'a',
  '4': 'a',
  '8': 'b',
  '3': 'e',
  '1': 'i',
  '!': 'i',
  '0': 'o',
  '$': 's',
  '5': 's',
  '7': 't',
};

/**
 * Reduces a password to the "word" a human would say it is: lowercased,
 * leading/trailing digits and symbols stripped, interior leetspeak
 * undone. "P@ssw0rd@2026" → "password"; "Kalm@12345" → "kalm".
 */
function corePassword(password: string): string {
  const stripped = password.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '');
  return stripped.replace(/[@4831!0$57]/g, (c) => LEET_MAP[c] ?? c);
}

// How many stripped characters (digits/symbols around the core word) we
// still treat as "decoration" rather than real added strength. 8 covers
// "@" + a full date like "@12051990" and "@12345678"-style tails.
const MAX_DECORATION_LENGTH = 8;

function isTrivialPattern(lower: string): boolean {
  // Every character the same ("aaaaaaaaaa", "1111111111").
  if (/^(.)\1+$/.test(lower)) return true;
  // A short chunk repeated to reach the length ("abcabcabcabc", "12121212").
  if (/^(.{1,4})\1+$/.test(lower)) return true;
  return false;
}

/** True if the password is on (or is a dressed-up variant of) the common list. */
export function isCommonPassword(password: string): boolean {
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return true;
  if (isTrivialPattern(lower)) return true;
  const core = corePassword(password);
  // A core that's empty means the password was all digits/symbols —
  // handled by the exact list + trivial-pattern checks above, not here.
  if (core.length === 0 || !COMMON_PASSWORDS.has(core)) return false;
  // Only reject when the decoration around the word is short — that's
  // the "word + year / @123" pattern. A list word followed by a long
  // random-looking tail ("dragon83920471!x") has most of its strength in
  // the tail, and rejecting it would just annoy people for no gain.
  return password.length - core.length <= MAX_DECORATION_LENGTH;
}

/** True if the password is the user's email, its local part, or a dressed-up variant of either. */
export function passwordMatchesEmail(password: string, email: string): boolean {
  const lowerEmail = email.toLowerCase().trim();
  const localPart = lowerEmail.split('@')[0] ?? '';
  const lower = password.toLowerCase();
  if (lower === lowerEmail || lower === localPart) return true;
  // Compare letters-only forms so "rahul.sharma" / "Rahul.Sharma@2026"
  // both match an email of rahul.sharma@gmail.com. Skip very short local
  // parts ("a@x.com") where this would reject too broadly.
  const localLetters = localPart.replace(/[^a-z]/g, '');
  if (localLetters.length < 4) return false;
  return corePassword(password).replace(/[^a-z]/g, '') === localLetters;
}

export const COMMON_PASSWORD_MESSAGE =
  'That password is too common and easy to guess. Try a longer phrase or mix of words that isn’t a name, place or “word + 123”.';

export const EMAIL_PASSWORD_MESSAGE = 'Your password can’t be your email address. Please choose something else.';

/**
 * Zod schema for a new password (signup / reset). Enforces length and the
 * common-password check. The email check needs the email too, so it lives
 * in `refinePasswordNotEmail` for object schemas that have both fields, or
 * is called directly via `passwordMatchesEmail` where the email comes
 * from the DB.
 */
export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`)
  .refine((p) => !isCommonPassword(p), COMMON_PASSWORD_MESSAGE);

/**
 * superRefine helper for object schemas with `email` + `password` fields.
 * Usage: z.object({ email, password: newPasswordSchema }).superRefine(refinePasswordNotEmail)
 */
export function refinePasswordNotEmail(
  data: { email: string; password: string },
  ctx: z.RefinementCtx
): void {
  if (passwordMatchesEmail(data.password, data.email)) {
    ctx.addIssue({ code: 'custom', path: ['password'], message: EMAIL_PASSWORD_MESSAGE });
  }
}
