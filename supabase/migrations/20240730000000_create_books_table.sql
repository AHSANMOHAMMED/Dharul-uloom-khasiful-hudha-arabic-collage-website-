-- Create the 'books' table
CREATE TABLE public.books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shamela_id INT UNIQUE,
    title_ar TEXT NOT NULL,
    title_en TEXT,
    author TEXT,
    categories TEXT[] DEFAULT ARRAY[]::TEXT[],
    description TEXT,
    language TEXT DEFAULT 'ar',
    year INT,
    pages INT,
    drive_file_id TEXT NOT NULL UNIQUE,
    drive_preview_url TEXT NOT NULL UNIQUE,
    cover_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) for the 'books' table
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

-- Create a policy for public read access
CREATE POLICY "Public users can view books" ON public.books
FOR SELECT USING (true);

-- Create a policy for admin write access (insert, update, delete)
-- This assumes you have a 'profiles' table with a 'role' column,
-- and that 'admin' is a recognized role.
-- If you don't have a 'profiles' table or a role system yet,
-- you might initially grant write access to authenticated users,
-- and refine this later. For now, let's assume an 'admin' role.

-- To make this work, you'll need a 'profiles' table and a function to get the user's role.
-- If you don't have this, you might start with a simpler authenticated write policy
-- and build out the role-based access later.
-- For a robust admin role, we usually join with a 'profiles' table.
-- Let's create a placeholder for admin RLS that relies on a future 'is_admin()' function.

-- IMPORTANT: This 'is_admin()' function needs to be created in your Supabase project.
-- Here's a common pattern:
-- CREATE FUNCTION public.is_admin()
-- RETURNS BOOLEAN
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- AS $$
--   BEGIN
--     RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
--   END;
-- $$;

CREATE POLICY "Admins can manage books" ON public.books
FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')) WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

-- If you don't have the 'profiles' table and 'is_admin()' function set up yet,
-- you can temporarily use a policy that allows authenticated users to write,
-- then switch to the admin-specific one once your role management is in place.
-- For a quick start (less secure for production without roles):
-- CREATE POLICY "Authenticated users can manage books" ON public.books
-- FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- For now, I'll stick with the admin policy as it's best practice for sensitive operations.
-- You will need to ensure your 'profiles' table and 'is_admin' logic is in place on Supabase.

-- Indexes for performance
CREATE INDEX idx_books_title_ar ON public.books USING GIN (to_tsvector('arabic', title_ar));
CREATE INDEX idx_books_title_en ON public.books (title_en);
CREATE INDEX idx_books_author ON public.books (author);
CREATE INDEX idx_books_categories ON public.books USING GIN (categories);
CREATE INDEX idx_books_language ON public.books (language);

-- Optionally, add foreign key constraint if categories are from a predefined list
-- This is more complex and might be out of scope for initial setup, but good to keep in mind.
-- For now, categories is a simple text array.
