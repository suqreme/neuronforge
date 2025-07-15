mark as the steps and phases are finished.

✅ PHASE 0: Project Setup & Foundations
Goal: Initialize the repo and core architecture.

Tasks:
 Create GitHub repo with /src, /docs, /prompts, /curriculum folders

 Set up Supabase project (auth, db, storage)

 Configure .env files with OpenAI, Supabase keys

 Choose frontend stack (SvelteKit or Next.js)

 Set up basic Tailwind CSS layout or UI kit (e.g., shadcn/ui)

✅ PHASE 1: Curriculum Tree + Prompt System Setup
Goal: Define all education paths and set up modular AI prompt loading.

Tasks:
 Create curriculum files:

/curriculum/math.json

/curriculum/english.json

etc.

 Define structure: grade → subject → topic → subtopic

 Build prompt files in /prompts:

ai-teacher.md

diagnostic.md

quiz-generator.md

reviewer.md

feedback.md

 Add prompt loader logic into backend GPT wrapper

 Validate that AI cannot run unless curriculum node is unlocked

Deliverables:
Curriculum tree system ready for use

Prompt files dynamically load per task

Version-controlled content engine

✅ PHASE 2: User Authentication + Diagnostic System
Goal: Place students using AI test + track login

Tasks:
 Sign up/login with email or guest ID

 Onboarding: “What grade do you think you're at?”

 AI delivers downward placement quiz (using diagnostic.md)

 Store final placement in user_progress table

✅ PHASE 3: Lesson + Quiz Engine
Goal: AI explains and tests user topic-by-topic

Tasks:
 GPT explains content using ai-teacher.md

 AI generates quiz (via quiz-generator.md)

 User takes quiz → score stored → retry if failed

 AI creates lesson summary (feedback.md)

 Save lesson + notes per topic

✅ PHASE 4: Progress Dashboard + Resume Flow
Goal: Track student learning and make navigation easy

Tasks:
 Show unlocked topics only

 Progress bar per subject

 “Continue where you left off” function

 View quiz scores, lesson notes

✅ PHASE 5: Shared Classroom Mode
Goal: Allow multiple learners on 1 device

Tasks:
 Classroom mode toggle

 Create local nicknamed profiles (Student A, B...)

 Store each student’s level + progress separately

 Export/import offline backups

✅ PHASE 6: Subscription + Hardship Access
Goal: Monetize access while supporting low-income learners

Tasks:
 Add subscription payment via Stripe

 Build hardship request form

 Admin can approve free access

 Track support/donation/scholarship users in DB

✅ PHASE 7: Admin Panel
Goal: Enable admins to monitor learning and finance activity

Tasks:
 User analytics (progress, region, activity)

 Review hardship forms

 Reward tagging (for top students)

 Export usage logs and finance reports

✅ PHASE 8: Donation Map + Impact Tracking
Goal: Showcase donations supporting education

Tasks:
 Allow rural users to request help

 Admin assigns donation to region

 Add pin to public map with “Thanks to [Donor Name]”

 Track center’s student count, story, and photos

✅ PHASE 9: Gamification & Motivation
Goal: Make learning addictive and satisfying

Tasks:
 Add flashcards, review mini-games

 Add XP + badge system

 Auto-generate certificate PDFs with QR verification

✅ PHASE 10+: Offline + Multilingual Support
Goal: Support disconnected communities and diverse languages

Tasks:
 Add language detection + translation fallback

 Add downloadable lesson packs (static or JSON)

 Preload voice content for offline playback

 Add print-friendly mode for no-internet classrooms

