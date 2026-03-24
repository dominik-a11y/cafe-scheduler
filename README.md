# Cafe Scheduler

Polish café scheduling management application built with Next.js 16.2.1 and Supabase.

## Features

- User authentication with Supabase
- Weekly schedule management
- Employee shift definitions with color coding
- Café operating hours management
- Employee invitation system
- Monthly reporting with hours calculations
- Role-based access control (admin/employee)
- Polish language interface

## Tech Stack

- Next.js 16.2.1
- React 19
- TypeScript
- Tailwind CSS 4.2.2
- Supabase (PostgreSQL)
- date-fns with Polish locale
- Lucide React (icons)

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables in `.env.local` (see `.env.example`)
4. Run development server: `npm run dev`
5. Open http://localhost:3000

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
