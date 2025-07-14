-- Enable RLS
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  country text,
  is_anonymous boolean DEFAULT false,
  subscription_status text DEFAULT 'free' CHECK (subscription_status IN ('free', 'paid', 'hardship')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Grades table
CREATE TABLE grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  order_index integer NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Subjects table
CREATE TABLE subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id uuid REFERENCES grades(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index integer NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Topics table
CREATE TABLE topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index integer NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Subtopics table
CREATE TABLE subtopics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid REFERENCES topics(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_index integer NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- User progress table
CREATE TABLE user_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  current_grade_id uuid REFERENCES grades(id),
  current_subject_id uuid REFERENCES subjects(id),
  current_topic_id uuid REFERENCES topics(id),
  current_subtopic_id uuid REFERENCES subtopics(id),
  placement_level text,
  total_xp integer DEFAULT 0,
  badges jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id)
);

-- Quiz results table
CREATE TABLE quiz_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  subtopic_id uuid REFERENCES subtopics(id) ON DELETE CASCADE,
  score integer NOT NULL,
  total_questions integer NOT NULL,
  answers jsonb NOT NULL,
  passed boolean NOT NULL,
  attempt_number integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Lesson notes table
CREATE TABLE lesson_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  subtopic_id uuid REFERENCES subtopics(id) ON DELETE CASCADE,
  notes text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Hardship requests table
CREATE TABLE hardship_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  admin_notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE hardship_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own progress" ON user_progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own quiz results" ON quiz_results FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own lesson notes" ON lesson_notes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own hardship requests" ON hardship_requests FOR ALL USING (auth.uid() = user_id);

-- Public read access for curriculum
CREATE POLICY "Anyone can view grades" ON grades FOR SELECT USING (true);
CREATE POLICY "Anyone can view subjects" ON subjects FOR SELECT USING (true);
CREATE POLICY "Anyone can view topics" ON topics FOR SELECT USING (true);
CREATE POLICY "Anyone can view subtopics" ON subtopics FOR SELECT USING (true);

-- Insert sample curriculum data
INSERT INTO grades (name, order_index) VALUES
('Kindergarten', 0),
('1st Grade', 1),
('2nd Grade', 2),
('3rd Grade', 3),
('4th Grade', 4),
('5th Grade', 5),
('6th Grade', 6),
('7th Grade', 7),
('8th Grade', 8),
('9th Grade', 9),
('10th Grade', 10),
('11th Grade', 11),
('12th Grade', 12);

-- Insert sample subjects for 1st Grade
INSERT INTO subjects (grade_id, name, order_index)
SELECT id, 'Mathematics', 1 FROM grades WHERE name = '1st Grade'
UNION ALL
SELECT id, 'English Language Arts', 2 FROM grades WHERE name = '1st Grade'
UNION ALL  
SELECT id, 'Science', 3 FROM grades WHERE name = '1st Grade'
UNION ALL
SELECT id, 'Social Studies', 4 FROM grades WHERE name = '1st Grade';

-- Insert sample topics for 1st Grade Math
INSERT INTO topics (subject_id, name, order_index)
SELECT s.id, 'Counting and Numbers', 1 
FROM subjects s 
JOIN grades g ON s.grade_id = g.id 
WHERE g.name = '1st Grade' AND s.name = 'Mathematics'
UNION ALL
SELECT s.id, 'Addition and Subtraction', 2
FROM subjects s 
JOIN grades g ON s.grade_id = g.id 
WHERE g.name = '1st Grade' AND s.name = 'Mathematics';

-- Insert sample subtopics
INSERT INTO subtopics (topic_id, name, order_index)
SELECT t.id, 'Numbers 1-10', 1
FROM topics t
JOIN subjects s ON t.subject_id = s.id
JOIN grades g ON s.grade_id = g.id
WHERE g.name = '1st Grade' AND s.name = 'Mathematics' AND t.name = 'Counting and Numbers'
UNION ALL
SELECT t.id, 'Numbers 11-20', 2
FROM topics t
JOIN subjects s ON t.subject_id = s.id
JOIN grades g ON s.grade_id = g.id
WHERE g.name = '1st Grade' AND s.name = 'Mathematics' AND t.name = 'Counting and Numbers';

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, is_anonymous)
  VALUES (new.id, new.email, false);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();