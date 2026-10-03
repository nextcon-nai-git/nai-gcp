# **App Name**: MAIN NextCon SST

## Core Features:

- Dashboard Overview: Displays key metrics like active employees, pending exams, expiring documents, and accident rates. Also includes an ESG scorecard. Pulls data from multiple Firestore collections and aggregates them into the main Dashboard UI.
- Risk Management (PGR): Dynamic table and heatmap visualizing risks per job role, sourced from the PGR NR01 collection. Uses a probability/severity matrix to calculate risk levels. Generative AI to find best practices risk mitigation plans that apply in similar environments using available web resources. Tool.
- Health Control (PCMSO): Calendar and alert system for medical exam expirations, based on the PCMSO NR07 collection. Highlights 'Inapt' or 'Pending' exams. Uses historical trends to suggest adjustments to timing of routine health exams.
- Legal & Financial Module: Tracks FAP tax reductions, visualizes legal claims and 'pericias' statuses from related Firestore collections. Includes a 'savings calculator'.
- Action Plan Manager: Kanban board to manage actions from PGR, CIPA, and Ergonomics, based on status (ToDo, In Progress, Done). Firestore serves as persistence for action plans.
- CSV Data Import: Enables uploading CSV files (Clientes.csv, Colaboradores.csv, etc.) to populate Firestore collections, triggering an update in the application UI when they are parsed correctly.
- Multi-Tenant Authentication: Secure authentication system using Firebase Authentication, that differentiates and filters access based on the user's role (Admin, Safety Tech, Client View) and which clients they are assigned to.

## Style Guidelines:

- Primary color: Based on Nextcon's website, use a gradient from dark blue (#00356B) to a lighter blue (#0077C8).
- Secondary color: Light blue (#ADD8E6) for backgrounds and accents, providing a clean and airy feel.
- Accent color: Orange (#F77F00) for key interactive elements and calls to action, drawing attention to important features.
- Body text font: 'Roboto' or 'Open Sans' for readability and a modern, professional look.
- Headline font: 'Montserrat' or 'Lato' for a clean and bold header style.
- Use a set of consistent and modern icons, preferably from Material Design Icons or Font Awesome, to represent different modules and actions. Use icons with a line style for a modern feel.
- Implement a clean and responsive sidebar navigation. Group navigation items logically into 'Operational', 'Medical', 'Legal', and 'Management' sections, mirroring the website's structure.
- Adopt a card-based layout for the dashboard and modules, providing a clear separation of information and a visually appealing structure.
- Use subtle animations and transitions for data updates, page transitions, and user interactions, enhancing the user experience without being distracting.
