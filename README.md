# MIST: Montreal Imaging Stress Task Implementation

A web-based replication of the Montreal Imaging Stress Task (MIST). This application induces moderate psychosocial stress through adaptive mental arithmetic and social evaluative threat.

## Tech Stack
* **Frontend:** React + Vite.
* **Backend/Database:** Supabase (Auth, PostgreSQL, Realtime).

---

## Research Protocol Implementation

### 1. The Adaptive Stress Engine
The core of the Experimental condition is an Induced Failure algorithm:
* [cite_start]**Baseline Calibration:** A 5-minute training session calculates the participant's unconstrained average response time across 5 difficulty levels[cite: 82, 87].
* [cite_start]**The 10% Rule:** Initial time limits in the stress condition are set to 10% less than the baseline[cite: 88].
* **Dynamic Scaling:**
    * [cite_start]3 Consecutive Correct -> Limit reduced by 10%[cite: 96].
    * [cite_start]3 Consecutive Incorrect/Timeout -> Limit increased by 10%[cite: 97].
* [cite_start]**Forced Accuracy:** The system automatically maintains a success rate of 20% to 45% to maximize psychological pressure[cite: 98].

### 2. Social Evaluative Threat (UI)
* [cite_start]**Dual Performance Bars:** Displays the participant's individual performance against a fake high-performing average[cite: 63, 100, 101].
* **Role-Based Access (RBAC):** Includes an Admin Dashboard for investigators to manage participants and remotely trigger Rest, Control, and Experimental sessions.
* [cite_start]**Feedback Interstitials:** Controlled intervals between runs where the investigator provides negative verbal feedback to increase cortisol response[cite: 102, 103, 166].

---

## Data Schema & Metrics
Every single trial is logged to Supabase for event-related analysis:
* [cite_start]**response_time_ms**: Precise latency of the calculation[cite: 82, 95].
* **current_limit_ms**: The adaptive time window active during the trial[cite: 65, 88].

---

## Setup & Installation

### Prerequisites
* Node.js 
* Supabase Project with Realtime enabled on the participant_state table.

### Environment Variables
Create a .env file in the root directory:
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_secret_service_role_key
Installation
Clone the repo:

Bash
git clone [https://github.com/your-username/mist-explorer.git](https://github.com/your-username/mist-explorer.git)
Install dependencies:

Bash
npm install
Run the development server:

Bash
npm run dev


Citation:
Dedovic, K., Renwick, R., Mahani, N. K., Engert, V., Lupien, S. J., & Pruessner, J. C. (2005). The Montreal Imaging Stress Task: using functional imaging to investigate the effects of perceiving and processing psychosocial stress in the human brain. Journal of Psychiatry and Neuroscience, 30(5), 319-325. 
+1

