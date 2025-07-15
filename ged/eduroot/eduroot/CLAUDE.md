# Project Documentation

# Phases
look into \home\ariappa\ged\phases.md and for build phases

## PRD (Product Requirements Document)
# 📘 PRD: AI-Powered GED & Homeschooling Platform

## 🧭 Product Name (Placeholder)

**EduRoot** – A global, AI-guided, self-paced education system for GED and K–12 students, accessible even in the most underserved parts of the world.

---

## 🎯 Purpose

To provide an AI-powered learning platform that helps children, teens, and adults learn from Grade 0 to high school senior level at their own pace. The system automatically determines their real knowledge level, guides them through structured lessons, and saves their progress — all in a lightweight and offline-friendly format. It includes support for classroom use in rural communities, donation-powered infrastructure, multilingual inclusivity, and a flexible subscription model that ensures no learner is left behind due to financial hardship.

---

## 🧑‍🏫 Target Users

* Homeschoolers and GED students of all ages
* Rural or underserved populations with limited internet/tech
* NGOs or educators seeking scalable education tools
* Volunteers and donors looking to contribute to global education
* Standard learners with internet access seeking affordable, structured education

---

## 🧩 Core Features

### 🟫 Core System

1. **User Authentication**

   * Signup/login (email or anonymous guest)
   * Country auto-detect or manual input
   * Accountless local mode supported in shared devices

2. **Curriculum Tree**

   * Admin-controlled structure: Grade → Subject → Topic → Subtopic
   * Stored in `/curriculum/*.json` format for easy editing and loading
   * Defines AI activation, lesson flow, and test gate logic

3. **Auto-Placement Diagnostic**

   * Students estimate current level
   * AI tests downward (e.g. if 5th grade chosen, test 1st–4th)
   * Student placed at weakest confirmed level

4. **Lesson Engine**

   * GPT-generated explanations per topic
   * Lesson ends with AI-generated quiz
   * Failing quiz triggers review & retry
   * Lesson notes auto-summarized and stored per user

   **AI Content Control via Curriculum Tree:**
   Each AI-powered lesson session is initiated only when a user reaches an approved node in the curriculum tree. The curriculum tree provides the exact structure, topic, and subtopic which the AI must follow.

   The AI is not allowed to "choose" or generate content outside of this tree. Instead, it is injected with:

   * The specific topic and learning objective
   * The user's current level and progress state
   * Any recent incorrect quiz topics (for review prompts)

   All GPT prompts used in the system are modular and stored in `/prompts/*.md` for maintainability.

5. **Progress Tracker**

   * All quiz scores, lesson notes, and status saved to DB or local session
   * Resume from last lesson
   * Visual tracker of grade, subject, topic

6. **Flexible Subscription Model**

   * Default subscription tier for regular users
   * Optional monthly fee to support platform (low-cost access)
   * Built-in hardship form: users can apply for free access if they cannot afford it
   * Admin panel tracks hardship cases, usage limits, and approval history
   * Scholarships or sponsorships can override subscription requirements per user

7. **Prompt Management System**

   * All AI instructions for tutors, quizzes, feedback, and placement tests are stored as modular markdown files in the `/prompts` folder
   * Prompts include: `ai-teacher.md`, `diagnostic.md`, `quiz-generator.md`, `reviewer.md`, and `feedback.md`
   * Prompts are loaded dynamically into GPT sessions and version-controlled

---

## 📂 Project Folder Structure (Addition)

```
/ai-ged-platform
│
├── /curriculum
│   ├── math.json
│   ├── english.json
│   └── ...
│
├── /prompts
│   ├── ai-teacher.md
│   ├── diagnostic.md
│   └── ...
│
├── /docs
│   └── PRD.md, roadmap.md
│
├── /supabase
│   └── schema.sql
│
└── /src (frontend/backend app code)
```

---


## 📈 Admin & Principal Features

1. **User Monitoring**

   * Filter users by country, classroom, activity level

2. **Progress Insights**

   * View scores, notes, failures, retries
   * Badge and certificate tracking

3. **Reward System**

   * Flag students for potential donation-based support (e.g., PC/tablet)
   * Export progress reports for donors

4. **Finance & Donation Panel**

   * Track ad revenue, donations, and subscription income
   * Assign donations to requests
   * Review hardship requests and approve free-tier access when appropriate

---

## 🌐 Donation Infrastructure & Global Education Map

1. **Help Request System**

   * Adults can request a PC/internet for their community
   * Admin reviews & validates the need

2. **Donation Tracking**

   * Social posts or campaigns call for donors
   * Donor name optionally displayed on site

3. **Impact Map**

   * Map pins show active education centers
   * Tooltip includes:

     * Location (Country, Village)
     * Number of students served
     * “Powered by \[Donor Name]”
     * Optional story/photo

---

## 🎮 Engagement & Retention

1. **Mini-Game Reviews**

   * Flashcards, drag/drop quizzes, speed matching
   * Triggered every few lessons

2. **Badges & XP System**

   * Milestones (first pass, 10 quizzes, 5 retries, etc.)
   * XP bar and level-up animation per student

3. **Certificates**

   * Auto-issued PDF for completing a topic, subject, or grade
   * Embedded QR code for authenticity

---

## 🧾 Guardian/Parent View

* Optional parent login
* See child progress, time spent, quiz results
* Encourage parental involvement, especially for young kids

---

## 🌐 Multilingual Support

* UI localized (priority: English, Spanish, Swahili, Arabic, French, Hindi)
* GPT prompts dynamically translated for lesson delivery
* Supports multilingual voice output with text-to-speech in future phase

---

## 🧪 AI Failsafe System

* “Was this helpful?” feedback after lessons
* If not helpful:

  * Retry simpler explanation
  * Retry with real-life example
  * Flag for admin review

---

## 🛡️ Data Integrity

* Auto-export data to JSON every few sessions
* Manual “Save Backup” to USB or cloud
* Import/export with QR code or text string (useful in offline centers)

---

## 🧭 Functional Flow

1. Student signs up or enters classroom mode
2. Diagnostic test determines placement
3. Student enters structured lesson path
4. AI teaches → quizzes → tracks progress
5. If offline: caches lessons/tests
6. Admins and donors monitor impact through dashboard and global map
7. Paid users contribute monthly (unless hardship override is active)
8. Hardship users can continue learning for free after review

---

## 🧱 Tech Stack

| Layer      | Tool                                                        |
| ---------- | ----------------------------------------------------------- |
| Frontend   | SvelteKit or Next.js                                        |
| Backend    | Supabase (auth, db, storage, edge functions)                |
| AI         | OpenAI GPT-4o, Whisper API                                  |
| Hosting    | Vercel, Render, or Fly.io                                   |
| Automation | Serverless cron jobs or Supabase edge functions             |
| Voice      | Whisper STT + TTS (fallback pre-rendered audio for offline) |

---

## ✅ Success Criteria

* Learners placed correctly and able to progress
* Platform performs even on low-end devices
* Shared devices track individuals without issues
* Donations and subscriptions are transparently connected to impact
* No student is blocked from learning due to poverty
* Retention and completion rates increase with badges, mini-games, and certificates
* System is easy for contributors to understand and extend
