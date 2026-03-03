export interface HelpArticle {
  id: string;
  title: string;
  description: string;
  icon: string;
  section: string;
  content: string; // markdown-like HTML
}

export interface HelpSection {
  id: string;
  title: string;
  icon: string;
  articles: HelpArticle[];
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: "🚀",
    articles: [
      {
        id: "what-is-mrca",
        title: "What is MrCA?",
        description: "Understand what MrCA does and how it helps your business",
        icon: "💡",
        section: "getting-started",
        content: `
<h2>What is MrCA?</h2>
<p>MrCA is a <strong>financial operating system</strong> built specifically for South African guesthouses, boutique hotels, and lodges. It's not just bookkeeping — it's a decision engine that tells you exactly how your business is performing at any moment.</p>

<div class="highlight">
  <strong>The north star:</strong> You open MrCA to <em>read results</em>, not to <em>do finance</em>. The system captures passively, surfaces actively.
</div>

<h3>What MrCA does</h3>
<ul>
  <li>📥 <strong>Bank Import</strong> — Upload your bank statement and transactions are auto-categorised using AI</li>
  <li>🏨 <strong>Bookings</strong> — Track every guest booking, check-in, check-out, and payment</li>
  <li>🔄 <strong>OTA Reconciliation</strong> — Match Booking.com, Airbnb, and Lekkerslaap payouts to your bank automatically</li>
  <li>📊 <strong>Intelligence</strong> — See your channel mix, room occupancy, RevPAR, and 6-month trends</li>
  <li>📈 <strong>Reports</strong> — Income Statement and Cash Flow Statement, always up to date</li>
  <li>👥 <strong>Payroll</strong> — Manage staff salaries, UIF, and advances</li>
  <li>🔐 <strong>Finance PIN</strong> — Protect financial data from staff members</li>
</ul>

<h3>Who is it for?</h3>
<p>MrCA is designed for <strong>accommodation property owners</strong> who want financial clarity without the complexity of traditional accounting software. If you run a guesthouse, BnB, lodge, or boutique hotel in South Africa — MrCA is built for you.</p>
        `,
      },
      {
        id: "5-min-setup",
        title: "5-Minute Setup Guide",
        description: "Get your property set up and running in under 5 minutes",
        icon: "⏱",
        section: "getting-started",
        content: `
<h2>5-Minute Setup Guide</h2>
<p>Follow these steps to get MrCA fully configured for your property.</p>

<div class="steps">
  <div class="step">
    <div class="step-number">1</div>
    <div class="step-content">
      <h4>Create your account</h4>
      <p>Register at <strong>mrca.co.za</strong> with your email. You'll receive a verification email — click the link to activate your account.</p>
    </div>
  </div>
  <div class="step">
    <div class="step-number">2</div>
    <div class="step-content">
      <h4>Set up your property</h4>
      <p>Go to <strong>Properties</strong> in the sidebar. Your property is already created — add your rooms, nightly rates, and property details.</p>
    </div>
  </div>
  <div class="step">
    <div class="step-number">3</div>
    <div class="step-content">
      <h4>Import your bank statement</h4>
      <p>Go to <strong>Import → Bank Statement</strong>. Select your bank (Capitec, Standard Bank, FNB, etc.), choose your property, upload your CSV, and click <em>Preview Transactions →</em>. MrCA's AI will auto-categorise everything.</p>
    </div>
  </div>
  <div class="step">
    <div class="step-number">4</div>
    <div class="step-content">
      <h4>Set your Finance PIN (optional)</h4>
      <p>If you have staff using the platform, go to <strong>Settings → Finance PIN Lock</strong> and set a 4-digit PIN. Staff will only see bookings and operations — financial data stays private.</p>
    </div>
  </div>
  <div class="step">
    <div class="step-number">5</div>
    <div class="step-content">
      <h4>Check your Dashboard</h4>
      <p>Head to the <strong>Dashboard</strong> to see your financial position. Revenue, expenses, cash position, and occupancy — all in one view.</p>
    </div>
  </div>
</div>

<div class="tip">
  <strong>💡 Tip:</strong> Start by importing your last 3 months of bank statements. This gives MrCA enough data to show meaningful trends and reports immediately.
</div>
        `,
      },
    ],
  },
  {
    id: "bank-import",
    title: "Bank Import",
    icon: "🏦",
    articles: [
      {
        id: "how-to-import",
        title: "How to Import a Bank Statement",
        description: "Step-by-step guide to uploading your bank CSV",
        icon: "📥",
        section: "bank-import",
        content: `
<h2>How to Import a Bank Statement</h2>
<p>MrCA supports CSV exports from all major South African banks. Here's how to do it.</p>

<h3>Step 1 — Download your bank CSV</h3>
<ul>
  <li><strong>Capitec Business</strong>: Capitec Business App → Accounts → Statement → Export CSV</li>
  <li><strong>Standard Bank</strong>: Internet Banking → Accounts → View Statement → Download CSV</li>
  <li><strong>FNB</strong>: Online Banking → Accounts → Statement → Export as CSV</li>
  <li><strong>ABSA</strong>: Internet Banking → My Accounts → Statement → Download CSV</li>
  <li><strong>Nedbank</strong>: Online Banking → Accounts → Transaction History → Export CSV</li>
</ul>

<h3>Step 2 — Upload in MrCA</h3>
<ol>
  <li>Go to <strong>Import → Bank Statement</strong> in the sidebar</li>
  <li>Select your <strong>Bank</strong> from the dropdown</li>
  <li>Select the <strong>Property</strong> this account belongs to</li>
  <li>Click <strong>Choose File</strong> and select your downloaded CSV</li>
  <li>Click the green <strong>Preview Transactions →</strong> button</li>
</ol>

<h3>Step 3 — Review and confirm</h3>
<p>MrCA shows a preview of all detected transactions with AI-suggested categories. Review them, adjust any categories you disagree with, then click <strong>Import All</strong>.</p>

<div class="warning">
  <strong>⚠️ Already imported?</strong> If you see "No new transactions found", the transactions from that file are already in the system. MrCA prevents duplicates automatically.
</div>

<div class="tip">
  <strong>💡 Tip:</strong> The more you use MrCA and correct categories, the smarter it gets. Your corrections are saved as rules that apply to future imports automatically.
</div>
        `,
      },
      {
        id: "auto-categorisation",
        title: "How Auto-Categorisation Works",
        description: "Understanding how MrCA categorises your transactions",
        icon: "🧠",
        section: "bank-import",
        content: `
<h2>How Auto-Categorisation Works</h2>
<p>MrCA uses a 3-layer intelligent system to categorise your transactions automatically.</p>

<div class="layers">
  <div class="layer">
    <div class="layer-badge">Layer 1</div>
    <h4>Rule Engine (Instant)</h4>
    <p>Checks against a library of SA-specific keywords. "Eskom" → Utilities, "Booking.com" → OTA Commission, "PosSettle" → Accommodation income. Instant, zero cost.</p>
  </div>
  <div class="layer">
    <div class="layer-badge layer-2">Layer 2</div>
    <h4>AI (GPT-4o-mini)</h4>
    <p>Anything the rules can't confidently classify gets sent to AI in a single batch. The AI understands SA business context — "Truck guy Wandile" becomes Maintenance, "Malume Mnguni" becomes Salaries.</p>
  </div>
  <div class="layer">
    <div class="layer-badge layer-3">Layer 3</div>
    <h4>Your Learning Rules</h4>
    <p>Every time you correct a category, MrCA saves that pattern. Next import, it applies automatically — no AI needed. Your property builds its own intelligence over time.</p>
  </div>
</div>

<h3>Managing your rules</h3>
<p>On the <strong>Transactions</strong> page, click <strong>⚙ Manage Rules</strong> to:</p>
<ul>
  <li>See all your saved rules (manual + learned)</li>
  <li>Add new keyword → category mappings</li>
  <li>Apply a rule to all existing transactions instantly</li>
  <li>Delete rules you no longer need</li>
</ul>

<div class="tip">
  <strong>💡 Pro tip:</strong> After your first import, spend 5 minutes in Manage Rules adding your regular payees. Every future import will be perfectly categorised from the start.
</div>
        `,
      },
    ],
  },
  {
    id: "bookings",
    title: "Bookings",
    icon: "🏨",
    articles: [
      {
        id: "adding-bookings",
        title: "Adding a Booking",
        description: "How to record a new guest booking",
        icon: "➕",
        section: "bookings",
        content: `
<h2>Adding a Booking</h2>
<p>Record every guest booking — whether it's a walk-in, phone booking, or OTA reservation.</p>

<h3>Creating a new booking</h3>
<ol>
  <li>Click the <strong>+</strong> button (bottom right) or go to <strong>Bookings → New Booking</strong></li>
  <li>Select the <strong>Property</strong> and <strong>Room</strong></li>
  <li>Enter <strong>Check-in</strong> and <strong>Check-out</strong> dates — MrCA shows room availability in real time</li>
  <li>Fill in <strong>Guest name</strong> and contact details</li>
  <li>Select the <strong>Booking source</strong> (Direct, Walk-in, Booking.com, Airbnb, Lekkerslaap, etc.)</li>
  <li>Enter the <strong>Rate</strong> and VAT settings</li>
  <li>Optionally collect payment immediately under <strong>Collect Payment Now</strong></li>
</ol>

<div class="tip">
  <strong>💡 Room availability:</strong> MrCA checks in real time — you'll see ✓ (available) or 🚫 (booked) for each room based on your selected dates.
</div>

<h3>Booking statuses</h3>
<ul>
  <li><strong>Confirmed</strong> — Booking is active</li>
  <li><strong>Checked In</strong> — Guest has arrived</li>
  <li><strong>Checked Out</strong> — Guest has departed</li>
  <li><strong>Cancelled</strong> — Booking was cancelled</li>
  <li><strong>No Show</strong> — Guest didn't arrive</li>
</ul>
        `,
      },
    ],
  },
  {
    id: "ota",
    title: "OTA Reconciliation",
    icon: "🔄",
    articles: [
      {
        id: "ota-reconciliation",
        title: "Reconciling OTA Payouts",
        description: "Match Booking.com, Airbnb and Lekkerslaap payouts to your bank",
        icon: "🔄",
        section: "ota",
        content: `
<h2>Reconciling OTA Payouts</h2>
<p>OTA reconciliation matches the payouts from Booking.com, Airbnb, and Lekkerslaap to your actual bank transactions — eliminating manual calculations.</p>

<h3>How to reconcile</h3>
<ol>
  <li>Go to <strong>OTA Payouts</strong> in the sidebar</li>
  <li>Click the <strong>Reconcile</strong> tab</li>
  <li>Select your OTA platform and upload the payout CSV</li>
  <li>MrCA matches each payout to your bank transactions</li>
  <li>Review matched/unmatched items and click <strong>Confirm Reconciliation</strong></li>
</ol>

<h3>Downloading OTA statements</h3>
<ul>
  <li><strong>Booking.com</strong>: Extranet → Finance → Invoices & Statements → Download CSV</li>
  <li><strong>Airbnb</strong>: Earnings → Transaction History → Download CSV</li>
  <li><strong>Lekkerslaap</strong>: Owner Portal → Payments → Export</li>
</ul>

<div class="tip">
  <strong>💡 Commission rates:</strong> MrCA automatically accounts for Booking.com (15%), Airbnb (~3.45%), and Lekkerslaap (~10% + 2% handling fee) commissions.
</div>
        `,
      },
    ],
  },
  {
    id: "transactions",
    title: "Transactions",
    icon: "💳",
    articles: [
      {
        id: "filtering-transactions",
        title: "Filtering & Searching Transactions",
        description: "Find exactly the transactions you need",
        icon: "🔍",
        section: "transactions",
        content: `
<h2>Filtering & Searching Transactions</h2>
<p>The Transactions page gives you a full view of all your financial activity with powerful filters.</p>

<h3>Available filters</h3>
<ul>
  <li><strong>Type</strong> — All / Income / Expense</li>
  <li><strong>Category</strong> — Filter by any transaction category</li>
  <li><strong>Date range</strong> — From and To date pickers</li>
  <li><strong>Property</strong> — Filter by specific property (top right)</li>
</ul>

<h3>Summary bar</h3>
<p>Above the transaction list, you'll always see a live summary reflecting your current filters:</p>
<ul>
  <li>🟢 <strong>Total Income</strong> — All income in the filtered period</li>
  <li>🔴 <strong>Total Expenses</strong> — All expenses in the filtered period</li>
  <li><strong>Net</strong> — Income minus expenses (green = surplus, red = deficit)</li>
  <li><strong>Ratio bar</strong> — Visual representation of income vs expenses</li>
</ul>

<h3>Deleting transactions</h3>
<p>To delete individual transactions, click the 🗑 icon on the right of any row. To delete multiple at once, tick the checkboxes and click <strong>Delete X selected</strong> in the amber action bar.</p>

<div class="warning">
  <strong>⚠️ Note:</strong> Deleted transactions affect your reports. Only delete transactions that were imported by mistake.
</div>
        `,
      },
    ],
  },
  {
    id: "reports",
    title: "Reports",
    icon: "📈",
    articles: [
      {
        id: "pl-report",
        title: "Income Statement (P&L)",
        description: "Understanding your profit and loss report",
        icon: "📊",
        section: "reports",
        content: `
<h2>Income Statement (P&L)</h2>
<p>The Income Statement shows your revenue, costs, and net profit for any period — the most important financial report for your business.</p>

<h3>How to read it</h3>
<ul>
  <li><strong>Revenue</strong> — All income: accommodation, F&B, laundry</li>
  <li><strong>Cost of Sales</strong> — Direct costs: cleaning, OTA commissions, supplies</li>
  <li><strong>Gross Profit</strong> — Revenue minus cost of sales</li>
  <li><strong>Operating Expenses</strong> — Salaries, utilities, maintenance, marketing</li>
  <li><strong>Net Profit</strong> — What's left after all expenses</li>
</ul>

<h3>Filtering by period</h3>
<p>Use the period selector at the top to view: This Month, Last Month, This Quarter, Last Quarter, This Year, or a Custom date range.</p>

<div class="tip">
  <strong>💡 Tip:</strong> Print or export your P&L monthly and file it. You'll need it for your accountant and for SARS tax submissions.
</div>
        `,
      },
      {
        id: "cash-flow",
        title: "Cash Flow Statement",
        description: "Understanding your cash flow report",
        icon: "💸",
        section: "reports",
        content: `
<h2>Cash Flow Statement</h2>
<p>The Cash Flow Statement shows where your cash came from and where it went — different from profit, which includes non-cash items.</p>

<h3>Key sections</h3>
<ul>
  <li><strong>Opening Balance</strong> — Cash at the start of the period</li>
  <li><strong>Cash Inflows</strong> — All money received (by category)</li>
  <li><strong>Cash Outflows</strong> — All money paid out (by category)</li>
  <li><strong>Closing Balance</strong> — Cash at the end of the period</li>
</ul>

<div class="tip">
  <strong>💡 Why it matters:</strong> You can be profitable on paper but cash-poor in reality. This report shows you the actual cash position of your business at any moment.
</div>
        `,
      },
    ],
  },
  {
    id: "security",
    title: "Security & Access",
    icon: "🔐",
    articles: [
      {
        id: "finance-pin",
        title: "Finance PIN Lock",
        description: "Protect financial data from staff members",
        icon: "🔐",
        section: "security",
        content: `
<h2>Finance PIN Lock</h2>
<p>If your staff use MrCA for operations (checking bookings, managing check-ins), you can protect all financial data behind a 4-digit PIN that only you know.</p>

<h3>What staff can see (without PIN)</h3>
<ul>
  <li>✅ Dashboard (operational view)</li>
  <li>✅ Bookings</li>
  <li>✅ Calendar</li>
  <li>✅ Properties</li>
</ul>

<h3>What requires the PIN</h3>
<ul>
  <li>🔐 Transactions</li>
  <li>🔐 Invoices</li>
  <li>🔐 Reports (P&L, Cash Flow)</li>
  <li>🔐 Payroll</li>
  <li>🔐 Intelligence & KPIs</li>
  <li>🔐 OTA Payouts</li>
  <li>🔐 Bank Import</li>
</ul>

<h3>Setting up the PIN</h3>
<ol>
  <li>Go to <strong>Settings</strong> in the sidebar</li>
  <li>Find the <strong>Finance PIN Lock</strong> card</li>
  <li>Click <strong>Set PIN</strong></li>
  <li>Enter a 4–8 digit PIN and confirm it</li>
  <li>Click <strong>Save PIN</strong></li>
</ol>

<div class="tip">
  <strong>💡 Session unlock:</strong> Once you enter your PIN, you stay unlocked for 8 hours. You won't be asked again until your session expires or you log out.
</div>

<div class="warning">
  <strong>⚠️ Important:</strong> If you forget your PIN, contact support. There is no self-service PIN reset.
</div>
        `,
      },
    ],
  },
  {
    id: "payroll",
    title: "Payroll",
    icon: "👥",
    articles: [
      {
        id: "running-payroll",
        title: "Running Payroll",
        description: "How to process staff salaries and UIF",
        icon: "💰",
        section: "payroll",
        content: `
<h2>Running Payroll</h2>
<p>MrCA handles payroll for SA small businesses — salary calculations, UIF deductions, and expense posting all in one step.</p>

<h3>How to run payroll</h3>
<ol>
  <li>Go to <strong>Payroll</strong> in the sidebar</li>
  <li>Click <strong>New Payroll Run</strong></li>
  <li>Select the pay period and property</li>
  <li>Review each employee's gross salary</li>
  <li>MrCA calculates UIF automatically (1% employee + 1% employer)</li>
  <li>Click <strong>Process Payroll</strong></li>
</ol>

<h3>What MrCA calculates for you</h3>
<ul>
  <li><strong>UIF</strong> — 1% employee + 1% employer contribution (capped at R177.12/month each)</li>
  <li><strong>Net pay</strong> — Gross minus employee UIF</li>
  <li><strong>PAYE</strong> — R0 for employees below the tax threshold (MrCA v1)</li>
</ul>

<h3>Salary advances</h3>
<p>If you gave an employee an advance during the month, record it under <strong>Advances</strong>. When payroll runs, MrCA automatically deducts outstanding advances from net pay.</p>

<div class="tip">
  <strong>💡 Automatic expense posting:</strong> When you mark payroll as paid, MrCA automatically creates expense transactions for staff wages and employer UIF contributions — your P&L stays accurate without double entry.
</div>
        `,
      },
    ],
  },
];

export function getAllArticles(): HelpArticle[] {
  return HELP_SECTIONS.flatMap((s) => s.articles);
}

export function getArticle(id: string): HelpArticle | undefined {
  return getAllArticles().find((a) => a.id === id);
}

export function getSection(id: string): HelpSection | undefined {
  return HELP_SECTIONS.find((s) => s.id === id);
}
