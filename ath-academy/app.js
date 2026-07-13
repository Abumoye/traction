/* ============================================================
   ATH ACADEMY — app.js
   Everything talks through the API object at the top. Right now
   API is wired to MOCK_DB so you can see the full flow working
   with no backend deployed. When Code.gs is live, replace the
   body of each API method with a fetch() to your Apps Script
   Web App URL — the function signatures already match what
   Code.gs returns. Search "SWAP FOR LIVE" below.

   RULES ENCODED HERE (per the July decisions):
   - One assessment attempt per course completion. Fail, and the
     course locks until every lesson is marked complete again.
   - 50-minute countdown once the assessment starts. Time out and
     it auto-submits whatever was answered.
   - Closing mid-lesson resumes where you left off (saved to this
     browser via localStorage — see README for cross-device notes).
     Closing mid-assessment forfeits the attempt; there is nothing
     to resume, by design.
   - Certificates get a numeric certificate ID, logged centrally,
     checkable on the public verify page.
   ============================================================ */

const PASS_MARK = 90;                 // percent, weighted
const QUESTIONS_PER_ASSESSMENT = 20;
const ASSESSMENT_SECONDS = 50 * 60;   // 50-minute countdown

/* ---------- The five real courses ----------
   Each is a single long-form YouTube "full course" video, so each course
   has one lesson for now. If you'd rather split a video into multiple
   lessons by timestamp (chapters), send the chapter breakdown and I'll
   split these into a proper multi-lesson sequence.

   Question banks: these are starter sets (20 per course, 100 total),
   written from general subject knowledge of each topic — not transcribed
   from the videos, since I can't watch multi-hour footage. That's the
   normal way a skills assessment works (it tests the subject, not verbatim
   recall of one video), but getting each course to a full, well-calibrated
   500 is a real content project on its own. Treat this batch as the
   pattern and the first slice; I can keep generating more in follow-up
   passes, or you can hand these to a subject-matter reviewer to expand.
   The same 100 questions are mirrored in Code.gs's seedAcademyData() so
   they land in your live Questions tab the first time you run it. */
const MOCK_DB = {
  member: {
    "ATH/FCT/120726/0143": { name: "Chidinma Okafor", code: "ATH/FCT/120726/0143", email: "" }
  },
  courses: [
    {
      id: "digital-marketing",
      tag: "Digital Marketing",
      title: "Digital Marketing Full Course",
      blurb: "SEO, paid ads, email, and content — the full toolkit for getting a business found online.",
      initials: "DM",
      thumb: "assets/thumbs/digital-marketing.png",
      learn: [
        "Tell the difference between SEO, SEM, and paid social",
        "Read the metrics that actually matter (CTR, CPC, conversion rate)",
        "Plan a content calendar around a real audience",
        "Build a basic email funnel from signup to sale"
      ],
      lessons: [
        { id: "l1", title: "Digital Marketing Full Course", desc: "The complete walkthrough — SEO, social, paid ads, email, and analytics.", youtubeId: "qnBhOVH1QQ8" }
      ],
      questionBank: [
        { q: "What does SEO stand for?", options: ["Search Engine Optimization", "Site Element Order", "Search Email Outreach", "Sales Engagement Objective"], correct: 0, weight: 1 },
        { q: "What does CTR measure?", options: ["Cost to reach", "Click-through rate", "Content transfer rate", "Customer trust rating"], correct: 1, weight: 2 },
        { q: "A 'conversion' in digital marketing means:", options: ["A visitor leaves the site", "A visitor completes a desired action, like a purchase or signup", "An ad gets rejected", "A page loads slowly"], correct: 1, weight: 2 },
        { q: "Which of these is 'owned media'?", options: ["A TV commercial", "A company's own website", "A newspaper article about the brand", "An influencer's unpaid post"], correct: 1, weight: 2 },
        { q: "CPC stands for:", options: ["Cost per click", "Content per campaign", "Customer purchase cycle", "Click per conversion"], correct: 0, weight: 1 },
        { q: "What is a 'bounce rate'?", options: ["The percentage of visitors who leave after viewing only one page", "The rate ads are rejected", "How fast a page loads", "The number of repeat customers"], correct: 0, weight: 2 },
        { q: "Which channel is best suited for long-term, compounding organic traffic?", options: ["Paid search ads", "SEO content", "Flash sales", "Cold email blasts"], correct: 1, weight: 2 },
        { q: "In email marketing, an 'open rate' measures:", options: ["How many recipients opened the email", "How many clicked a link inside it", "How many unsubscribed", "How many emails bounced"], correct: 0, weight: 1 },
        { q: "A/B testing in marketing is used to:", options: ["Compare two versions of something to see which performs better", "Send two emails at once", "Split a budget between two platforms", "Test a website's loading speed"], correct: 0, weight: 2 },
        { q: "What's the primary goal of a marketing funnel?", options: ["To decorate a landing page", "To guide a stranger toward becoming a customer step by step", "To reduce ad spend to zero", "To automate customer support"], correct: 1, weight: 2 },
        { q: "Which metric best reflects ad efficiency, not just reach?", options: ["Impressions", "Return on ad spend (ROAS)", "Follower count", "Page likes"], correct: 1, weight: 3 },
        { q: "What is a 'lead magnet'?", options: ["A paid advertisement", "Something of value offered in exchange for contact information", "A type of email spam filter", "A social media algorithm"], correct: 1, weight: 2 },
        { q: "Retargeting ads are shown to:", options: ["Anyone on the internet", "People who have already interacted with your brand", "Only new customers", "Competitors' customers exclusively"], correct: 1, weight: 2 },
        { q: "Which is a paid marketing channel?", options: ["Organic search results", "Google Ads", "Word of mouth", "A blog post"], correct: 1, weight: 1 },
        { q: "What does 'organic reach' refer to?", options: ["Reach gained without paying for promotion", "Reach only from farming-related brands", "Reach from paid ads", "Reach measured in kilometers"], correct: 0, weight: 1 },
        { q: "A buyer persona is:", options: ["A legal document", "A semi-fictional profile of your ideal customer", "A pricing strategy", "A type of ad format"], correct: 1, weight: 2 },
        { q: "Which is the best first step before running paid ads?", options: ["Defining a clear target audience and goal", "Spending the entire budget on day one", "Skipping analytics setup", "Copying a competitor's ad exactly"], correct: 0, weight: 2 },
        { q: "UGC in marketing stands for:", options: ["User-Generated Content", "Universal Growth Campaign", "Unique Global Currency", "Updated Graphic Content"], correct: 0, weight: 1 },
        { q: "What's the main risk of ignoring analytics?", options: ["Ads load faster", "Decisions get made on guesswork instead of evidence", "SEO improves automatically", "Nothing — analytics is optional"], correct: 1, weight: 2 },
        { q: "Which best describes 'content marketing'?", options: ["Buying ad space only", "Creating valuable content to attract and retain an audience", "Cold calling leads", "Printing flyers"], correct: 1, weight: 2 }
      ]
    },
    {
      id: "capcut-editing",
      tag: "Video Editing",
      title: "CapCut for Beginners",
      blurb: "Mobile video editing from a blank timeline to a polished, ready-to-post clip.",
      initials: "CC",
      thumb: "assets/thumbs/capcut.png",
      learn: [
        "Trim, split, and arrange clips on the CapCut timeline",
        "Add text, captions, and transitions that don't feel default",
        "Use basic color and audio adjustments",
        "Export at the right resolution for each platform"
      ],
      lessons: [
        { id: "l1", title: "CapCut Course for Beginners", desc: "A full walkthrough of the CapCut interface and core editing workflow.", youtubeId: "68KNzsmBarM" }
      ],
      questionBank: [
        { q: "In CapCut, what does 'splitting' a clip do?", options: ["Deletes the clip", "Cuts a clip into two separate pieces at the playhead", "Merges two clips", "Changes the clip's color"], correct: 1, weight: 1 },
        { q: "Which tool would you use to make a clip play in slow motion?", options: ["Speed", "Crop", "Filter", "Voiceover"], correct: 0, weight: 2 },
        { q: "What is a 'keyframe' used for?", options: ["Deleting audio", "Animating a property (like zoom or position) to change over time", "Adding subtitles automatically", "Locking the export settings"], correct: 1, weight: 3 },
        { q: "What's the purpose of a transition between two clips?", options: ["To change the video's title", "To smooth or stylize the switch from one clip to the next", "To add background music", "To increase export resolution"], correct: 1, weight: 1 },
        { q: "Which export setting most affects file size and clarity?", options: ["Resolution", "Font choice", "Caption position", "Track name"], correct: 0, weight: 2 },
        { q: "Auto captions in CapCut are generated from:", options: ["The video's spoken audio", "The video's file name", "A random word list", "The thumbnail image"], correct: 0, weight: 1 },
        { q: "What does the 'crop' tool primarily change?", options: ["The audio pitch", "The visible frame or aspect ratio of a clip", "The clip's speed", "The export format"], correct: 1, weight: 1 },
        { q: "Which aspect ratio is standard for TikTok/Reels/Shorts?", options: ["16:9", "9:16", "1:1", "4:3"], correct: 1, weight: 2 },
        { q: "What is a 'green screen' effect used for in CapCut?", options: ["Adding a green filter", "Replacing a solid-colored background with another image or video", "Making text green", "Boosting audio volume"], correct: 1, weight: 2 },
        { q: "Lowering a clip's opacity in an overlay track does what?", options: ["Makes it louder", "Makes it more transparent", "Deletes the audio", "Speeds it up"], correct: 1, weight: 2 },
        { q: "What's the benefit of using 'auto reframe' or similar tools?", options: ["It automatically repositions footage to fit a different aspect ratio", "It adds background music", "It corrects spelling in captions", "It compresses the file"], correct: 0, weight: 2 },
        { q: "Which track type typically holds background music, separate from dialogue?", options: ["Text track", "Audio track", "Sticker track", "Filter track"], correct: 1, weight: 1 },
        { q: "What does 'freeze frame' do?", options: ["Pauses the whole export", "Holds a single frame still for a chosen duration", "Deletes a clip's audio", "Reverses the clip"], correct: 1, weight: 2 },
        { q: "Why would you use keyframed zoom on a static photo?", options: ["To fix audio sync", "To add subtle motion to an otherwise still image", "To change its file format", "To delete the background"], correct: 1, weight: 2 },
        { q: "What's a safe way to keep captions readable on any background?", options: ["Use a text outline or background box behind the text", "Always use the smallest font size", "Only use white text", "Remove captions entirely"], correct: 0, weight: 2 },
        { q: "Which comes first in a typical basic edit workflow?", options: ["Exporting", "Importing and arranging clips on the timeline", "Adding the final color grade", "Publishing to social media"], correct: 1, weight: 1 },
        { q: "What does adjusting 'volume' on a specific clip affect?", options: ["Only that clip's audio level", "The entire project's audio", "The video's brightness", "The export resolution"], correct: 0, weight: 1 },
        { q: "A jump cut is:", options: ["A hard cut between two similar shots that creates a noticeable jump", "A type of transition effect", "An audio distortion", "A caption style"], correct: 0, weight: 2 },
        { q: "Why trim silence from the start of a clip before editing further?", options: ["It's required by CapCut", "It tightens pacing and avoids dead air", "It automatically improves resolution", "It changes the aspect ratio"], correct: 1, weight: 1 },
        { q: "What's the purpose of exporting a draft at lower resolution first?", options: ["To check the edit quickly without a long export wait", "It's the only way to export", "To save the project permanently", "To add captions automatically"], correct: 0, weight: 1 }
      ]
    },
    {
      id: "tiktok-ads",
      tag: "Paid Advertising",
      title: "How to Run TikTok Ads",
      blurb: "Setting up, targeting, and reading results on TikTok's ad platform.",
      initials: "TT",
      thumb: "assets/thumbs/tiktok-ads.png",
      learn: [
        "Set up a TikTok Ads Manager account and campaign structure",
        "Choose the right objective and targeting for a goal",
        "Understand budget types and bidding basics",
        "Read campaign results and know what to adjust"
      ],
      lessons: [
        { id: "l1", title: "How to Run TikTok Ads — Full Course", desc: "Campaign setup, targeting, creative, and reading your results.", youtubeId: "T1xOxbGUB-A" }
      ],
      questionBank: [
        { q: "In TikTok Ads Manager, campaigns are built in which order?", options: ["Ad Group → Campaign → Ad", "Campaign → Ad Group → Ad", "Ad → Campaign → Ad Group", "There is no set structure"], correct: 1, weight: 2 },
        { q: "What does the campaign 'objective' determine?", options: ["The font used in ads", "What TikTok optimizes delivery for, like traffic or conversions", "The account's username", "The video's aspect ratio only"], correct: 1, weight: 2 },
        { q: "What is a 'lifetime budget'?", options: ["A fixed total spend across the whole campaign duration", "A daily spend cap only", "An unlimited budget", "A one-time payment to TikTok"], correct: 0, weight: 2 },
        { q: "Narrow targeting (very small audience) usually risks:", options: ["Faster ad approval", "Limited delivery and higher costs per result", "Guaranteed higher sales", "Lower creative requirements"], correct: 1, weight: 2 },
        { q: "What does CPM stand for?", options: ["Cost per thousand impressions", "Cost per minute", "Clicks per minute", "Campaign performance metric"], correct: 0, weight: 1 },
        { q: "Which is typically true of native, less 'ad-like' TikTok creative?", options: ["It usually performs worse than polished commercials", "It often performs better because it blends with organic content", "It's not allowed on the platform", "It can't include a call to action"], correct: 1, weight: 2 },
        { q: "What is a 'Spark Ad' on TikTok?", options: ["An ad format that boosts an existing organic post", "A type of banned content", "A discount code", "An automatic bidding strategy"], correct: 0, weight: 2 },
        { q: "What should you check first if a campaign has high impressions but almost no clicks?", options: ["The account's payment method", "The ad creative and hook, and whether targeting matches the offer", "The company's tax ID", "The app's version number"], correct: 1, weight: 3 },
        { q: "What does 'frequency' measure in ad reporting?", options: ["How often the ad account logs in", "The average number of times a unique user saw the ad", "How many ads are in a campaign", "How fast a video loads"], correct: 1, weight: 2 },
        { q: "A pixel (or TikTok's equivalent tracking tag) is used to:", options: ["Track user actions on your website after they click an ad", "Change ad colors automatically", "Increase video resolution", "Block competitor ads"], correct: 0, weight: 2 },
        { q: "What's a common first sign that an ad's creative is fatiguing (getting stale)?", options: ["Rising costs and falling engagement over time with no other changes", "Sudden drop in account balance", "A change in campaign objective", "The ad account gets suspended"], correct: 0, weight: 2 },
        { q: "Which metric most directly reflects cost-efficiency toward a sale?", options: ["Cost per result / cost per acquisition", "Total impressions", "Number of ad groups", "Video watch count alone"], correct: 0, weight: 3 },
        { q: "What is 'lookalike' or 'similar audience' targeting based on?", options: ["Random selection", "Characteristics of an existing audience, like past customers", "Geographic location only", "Ad spend amount"], correct: 1, weight: 2 },
        { q: "Why run a small test budget before scaling a campaign?", options: ["It's required by law", "To validate performance before committing a larger budget", "It guarantees approval", "It increases the CPM automatically"], correct: 1, weight: 2 },
        { q: "What typically happens if an ad violates TikTok's advertising policies?", options: ["It gets boosted for visibility", "It gets rejected or taken down during review", "Nothing changes", "The advertiser is refunded automatically"], correct: 1, weight: 1 },
        { q: "A strong hook in the first few seconds of a TikTok ad mainly helps:", options: ["Increase watch time and reduce early drop-off", "Lower the video's resolution", "Bypass the review process", "Reduce targeting options"], correct: 0, weight: 2 },
        { q: "What does 'optimization event' refer to in campaign setup?", options: ["The specific action TikTok's algorithm tries to get more of, like purchases", "The time of day ads run", "The ad's file format", "The account's creation date"], correct: 0, weight: 2 },
        { q: "Broad targeting with strong creative often performs well because:", options: ["It gives the algorithm more room to find responsive users", "It always costs less per impression", "It skips the review process", "It disables tracking"], correct: 0, weight: 2 },
        { q: "What's a reasonable first move if cost per result is rising sharply?", options: ["Immediately delete the ad account", "Review targeting, creative fatigue, and budget pacing before making changes", "Increase the budget tenfold", "Switch the business category"], correct: 1, weight: 2 },
        { q: "Which is NOT typically a campaign objective category?", options: ["Traffic", "Conversions", "Weather forecasting", "Awareness/Reach"], correct: 2, weight: 1 }
      ]
    },
    {
      id: "google-docs-basics",
      tag: "Digital Skills",
      title: "How to Use Google Docs",
      blurb: "Everyday document skills — formatting, sharing, and collaborating without friction.",
      initials: "GD",
      thumb: "assets/thumbs/google-docs.png",
      learn: [
        "Format and structure a document so it's easy to read",
        "Share and set the right permission level for each collaborator",
        "Use comments and suggestions for feedback without messy edits",
        "Work with headers, page breaks, and basic layout tools"
      ],
      lessons: [
        { id: "l1", title: "Google Docs for Beginners", desc: "A full walkthrough of formatting, sharing, and collaborating in Google Docs.", youtubeId: "RzNVGQYOmFk" }
      ],
      questionBank: [
        { q: "What does 'Suggesting' mode do in Google Docs?", options: ["Deletes text permanently", "Tracks proposed edits without changing the original text until accepted", "Shares the doc publicly", "Locks the document from editing"], correct: 1, weight: 2 },
        { q: "Which sharing permission lets someone edit but not change sharing settings?", options: ["Viewer", "Commenter", "Editor", "Owner"], correct: 2, weight: 2 },
        { q: "What is the fastest way to leave feedback on a specific sentence without editing it?", options: ["Delete the sentence", "Add a comment", "Change the font color", "Print the document"], correct: 1, weight: 1 },
        { q: "What does 'Version history' let you do?", options: ["Change the document's owner", "See and restore earlier versions of the document", "Convert the file to PDF", "Add collaborators"], correct: 1, weight: 2 },
        { q: "Which feature automatically generates a list of headings for navigation?", options: ["Table of contents", "Footnotes", "Page numbers", "Word count"], correct: 0, weight: 2 },
        { q: "What's the difference between 'Anyone with the link' and inviting specific people?", options: ["No difference at all", "Link sharing opens access to anyone who has the URL, not just named people", "Named invites are always public", "Link sharing is more secure"], correct: 1, weight: 2 },
        { q: "Which shortcut typically opens 'Find and replace'?", options: ["Ctrl/Cmd + H", "Ctrl/Cmd + P", "Ctrl/Cmd + B", "Ctrl/Cmd + S"], correct: 0, weight: 1 },
        { q: "What does applying a 'Heading' style (vs. just bold text) enable?", options: ["Nothing extra beyond appearance", "Structure that powers the table of contents and document outline", "Automatic translation", "Faster printing"], correct: 1, weight: 2 },
        { q: "How does Google Docs typically save changes?", options: ["Manually only, via Ctrl/Cmd+S", "Automatically, as you type", "Only when you close the tab", "Only when a collaborator approves"], correct: 1, weight: 1 },
        { q: "What is the purpose of 'page break' in a document?", options: ["To delete the current page", "To force the next content to start on a new page", "To change the font", "To add a comment"], correct: 1, weight: 1 },
        { q: "Which tool would you use to insert a chart from Google Sheets into a Doc?", options: ["Insert > Chart > From Sheets", "Format > Paragraph styles", "Tools > Spelling", "File > Print"], correct: 0, weight: 2 },
        { q: "What does 'Explore' (or a similar research tool) help you do?", options: ["Search the web and insert citations without leaving the document", "Automatically fix all typos", "Change the document's owner", "Compress images"], correct: 0, weight: 1 },
        { q: "Why use 'Viewer' access instead of 'Editor' for some collaborators?", options: ["It's the only free option", "To let people read without risking accidental changes", "Viewer access is required for comments", "There's no functional difference"], correct: 1, weight: 2 },
        { q: "What happens when you resolve a comment thread?", options: ["The comment is permanently deleted with no record", "It's marked resolved and hidden from the main view, but still recoverable", "The document is locked", "All suggestions are auto-accepted"], correct: 1, weight: 2 },
        { q: "Which feature helps keep consistent formatting across a long document?", options: ["Paragraph/heading styles", "Random font changes", "Manual spacing on every line", "Copy-pasting from different sources"], correct: 0, weight: 2 },
        { q: "What's a quick way to convert a Google Doc to a downloadable Word file?", options: ["File > Download > Microsoft Word (.docx)", "It's not possible", "Insert > Word", "Tools > Convert"], correct: 0, weight: 1 },
        { q: "What does '@mentioning' someone in a comment typically do?", options: ["Nothing, it's just text", "Notifies that person and can grant them access if they don't have it", "Deletes their access", "Changes their permission to Owner"], correct: 1, weight: 2 },
        { q: "Why might you use 'Bookmark' or internal links in a long document?", options: ["To jump directly to a specific section from elsewhere in the doc", "To share the document externally", "To change page orientation", "To lock specific paragraphs"], correct: 0, weight: 2 },
        { q: "Which best describes 'Offline mode' in Google Docs?", options: ["Editing is impossible without internet", "You can view and edit certain docs without an active connection, syncing once reconnected", "It permanently disables sharing", "It only works on desktop"], correct: 1, weight: 1 },
        { q: "What is the benefit of using bullet or numbered lists over plain paragraphs for steps?", options: ["No real benefit", "Improves scannability and clarifies sequence or grouping", "It changes the document language", "It reduces file size significantly"], correct: 1, weight: 1 }
      ]
    },
    {
      id: "social-media-manager",
      tag: "Social Media",
      title: "Social Media Manager Full Course",
      blurb: "Planning, posting, and reporting on social accounts the way a professional manager does.",
      initials: "SM",
      thumb: "assets/thumbs/social-media-manager.png",
      learn: [
        "Build a content calendar tied to real goals, not guesswork",
        "Know which metrics matter for which platform",
        "Handle comments, DMs, and community management professionally",
        "Put together a simple monthly performance report"
      ],
      lessons: [
        { id: "l1", title: "Social Media Manager Full Course", desc: "Strategy, content planning, publishing, community management, and reporting.", youtubeId: "bgrA3kuZpWk" }
      ],
      questionBank: [
        { q: "What should a content calendar be built around first?", options: ["Whatever is trending that day", "Clear goals and the audience you're trying to reach", "The manager's personal preferences", "Competitor copy-paste"], correct: 1, weight: 2 },
        { q: "Engagement rate is generally calculated as:", options: ["Total followers divided by posts", "Interactions (likes, comments, shares) relative to reach or followers", "Number of hashtags used", "Posting frequency per week"], correct: 1, weight: 2 },
        { q: "Why track reach separately from impressions?", options: ["They're always identical", "Reach counts unique viewers, impressions count total views including repeats", "Reach only applies to paid posts", "Impressions don't exist on social platforms"], correct: 1, weight: 2 },
        { q: "What's a reasonable first response to a negative public comment from a real customer?", options: ["Delete it immediately without response", "Acknowledge it professionally and move detailed resolution to a private channel", "Argue publicly to defend the brand", "Ignore it completely"], correct: 1, weight: 3 },
        { q: "A 'content pillar' is:", options: ["A physical prop used in photos", "A core recurring theme that content is organized around", "A paid ad format", "A type of analytics dashboard"], correct: 1, weight: 2 },
        { q: "Why does posting consistency generally matter?", options: ["It has no effect on performance", "It builds audience expectation and can support algorithmic visibility", "It guarantees virality", "Platforms penalize any regular schedule"], correct: 1, weight: 2 },
        { q: "What belongs in a basic monthly social media report?", options: ["Only follower count", "Key metrics against goals, top-performing content, and takeaways", "A list of every single post with no analysis", "Competitor login credentials"], correct: 1, weight: 2 },
        { q: "Which is a community management task?", options: ["Designing the company logo", "Responding to comments and DMs in a timely, on-brand way", "Filing tax returns", "Negotiating office rent"], correct: 1, weight: 1 },
        { q: "What's the risk of posting the same content identically across every platform?", options: ["No risk, platforms are interchangeable", "Missing each platform's format, tone, and audience expectations", "Guaranteed higher engagement everywhere", "Accounts get automatically merged"], correct: 1, weight: 2 },
        { q: "A 'call to action' in a social post is meant to:", options: ["Decorate the caption", "Tell the viewer exactly what to do next, like 'comment below' or 'shop now'", "Increase the character count", "Replace the need for a caption"], correct: 1, weight: 1 },
        { q: "Why review analytics before planning the next month's content?", options: ["It's not necessary if content looks good", "To repeat what worked and adjust or drop what didn't", "Analytics only matter for paid ads", "To copy a competitor's exact calendar"], correct: 1, weight: 2 },
        { q: "What does 'social listening' involve?", options: ["Only posting content, never reading responses", "Monitoring mentions, comments, and conversations about a brand or topic", "Turning off comments", "Deleting negative reviews"], correct: 1, weight: 2 },
        { q: "Which is generally true about short-form video across platforms right now?", options: ["It's a minor, declining format", "It tends to drive strong reach relative to other formats", "It performs identically to static images always", "It's banned on most platforms"], correct: 1, weight: 2 },
        { q: "What's the value of a brand voice/tone guide for a social team?", options: ["It restricts creativity with no benefit", "It keeps posts consistent even when different people are writing them", "It's only needed for legal documents", "It replaces the need for a content calendar"], correct: 1, weight: 2 },
        { q: "When a post underperforms, what's a useful first diagnostic question?", options: ["Was the timing, format, or hook off compared to what usually works?", "Should the account be deleted?", "Is the platform broken?", "Should posting stop entirely?"], correct: 0, weight: 2 },
        { q: "What's a practical reason to repurpose one piece of content across formats (e.g. a video into a carousel)?", options: ["It's required by every platform's terms of service", "It extends the value of one idea without starting from scratch each time", "It guarantees identical performance everywhere", "It removes the need for analytics"], correct: 1, weight: 2 },
        { q: "Handling a crisis or PR issue on social media should generally start with:", options: ["Posting jokes to lighten the mood", "A calm, honest, and timely acknowledgment, escalated internally as needed", "Deleting the account", "Blocking everyone who comments"], correct: 1, weight: 2 },
        { q: "What's the purpose of A/B testing captions or thumbnails?", options: ["To waste time", "To learn what resonates better with the audience using evidence, not guesses", "It's only possible with a huge budget", "To confuse the algorithm"], correct: 1, weight: 2 },
        { q: "Why is knowing peak audience activity times useful?", options: ["It has no real impact on reach", "Posting when your audience is active tends to support better initial engagement", "It's only relevant for paid campaigns", "It guarantees a post goes viral"], correct: 1, weight: 1 },
        { q: "What best describes the role of a social media manager overall?", options: ["Only designing graphics", "Planning, publishing, engaging, and reporting on a brand's social presence toward real goals", "Managing the company payroll", "Writing legal contracts"], correct: 1, weight: 1 }
      ]
    }
  ]
};

/* ---------- API layer ---------- */
const API = {
  async verifyMember(code) {
    // SWAP FOR LIVE:
    // const res = await fetch(APPS_SCRIPT_URL + "?action=verifyMember&code=" + encodeURIComponent(code));
    // return await res.json();
    await sleep(250);
    const member = MOCK_DB.member[code.trim().toUpperCase()];
    return member ? { ok: true, member } : { ok: false };
  },
  async getCourses() {
    await sleep(150);
    return MOCK_DB.courses.map(c => ({ id: c.id, tag: c.tag, title: c.title, blurb: c.blurb, initials: c.initials, thumb: c.thumb, lessonCount: c.lessons.length }));
  },
  async getCourse(courseId) {
    await sleep(150);
    return MOCK_DB.courses.find(c => c.id === courseId);
  },
  async getAssessment(courseId) {
    // SWAP FOR LIVE: Code.gs does this same selection server-side against the
    // full 500-row bank and returns an assessmentId. The correct answers are
    // held server-side in a Sessions row, not sent to the browser — scoring
    // happens in submitAssessment(), server-side, so the pass/fail can't be
    // read or edited from the network tab.
    await sleep(200);
    const course = MOCK_DB.courses.find(c => c.id === courseId);
    const shuffled = shuffle([...course.questionBank]);
    const picked = shuffled.slice(0, Math.min(QUESTIONS_PER_ASSESSMENT, shuffled.length));
    const questions = picked.map(q => {
      const optOrder = shuffle(q.options.map((text, i) => ({ text, isCorrect: i === q.correct })));
      return { q: q.q, weight: q.weight, options: optOrder };
    });
    return { assessmentId: 'demo-' + Date.now(), questions };
  },
  async recordAttempt(payload) {
    // SWAP FOR LIVE: POST payload to Code.gs -> recordAttempt. That handler
    // logs the attempt, WhatsApp-notifies you via CallMeBot either way, and
    // emails the member a "retake the course" link if they didn't pass.
    await sleep(80);
    return { ok: true };
  },
  async issueCertificate(payload) {
    // SWAP FOR LIVE: POST payload to Code.gs -> issueCertificate, which
    // generates the numeric certificate ID and logs it to the Certificates
    // sheet. Doesn't email anything yet — that's a second call, once the
    // browser has drawn the certificate image with the real number on it.
    await sleep(150);
    const certId = MOCK_DB._certSeq = (MOCK_DB._certSeq || 100000) + 1;
    return { certId: String(certId) };
  },
  async emailCertificate(payload) {
    // SWAP FOR LIVE: POST payload (including the base64 PNG straight off
    // the canvas) to Code.gs -> emailCertificate, which attaches it and
    // sends it to the member's address on file.
    await sleep(100);
    return { ok: true };
  }
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- Local progress store ----------
   Course progress (which lessons are done, and whether the course
   is currently locked after a failed attempt) is saved to this
   browser only. See README for the cross-device tradeoff. */
const Progress = {
  key(memberCode, courseId) { return `ath-academy:${memberCode}:${courseId}`; },
  load(memberCode, courseId) {
    try {
      const raw = localStorage.getItem(this.key(memberCode, courseId));
      return raw ? JSON.parse(raw) : { completedLessons: [], locked: false };
    } catch (e) { return { completedLessons: [], locked: false }; }
  },
  save(memberCode, courseId, data) {
    try { localStorage.setItem(this.key(memberCode, courseId), JSON.stringify(data)); } catch (e) {}
  }
};

/* ---------- State ---------- */
let state = {
  member: null,
  currentCourse: null,
  lessonIndex: 0,
  completedLessons: new Set(),
  locked: false,
  quiz: { questions: [], index: 0, answers: [], selectedOption: null, timer: null, secondsLeft: ASSESSMENT_SECONDS }
};

/* ---------- Screen switching ---------- */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/* ---------- Login ---------- */
document.getElementById('login-btn').addEventListener('click', doLogin);
document.getElementById('member-code').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

async function doLogin() {
  const codeInput = document.getElementById('member-code');
  const err = document.getElementById('login-error');
  const idle = document.getElementById('login-idle');
  const rolling = document.getElementById('login-rolling');

  if (!codeInput.value.trim()) return;
  err.classList.remove('show');
  idle.classList.add('hidden');
  rolling.classList.add('active');

  const result = await API.verifyMember(codeInput.value);
  // Let the rolling animation play for a beat even on a fast response —
  // an instant flash reads as broken, not fast.
  await sleep(600);

  if (!result.ok) {
    rolling.classList.remove('active');
    idle.classList.remove('hidden');
    err.classList.add('show');
    return;
  }
  state.member = result.member;
  document.getElementById('member-chip').style.display = 'block';
  document.getElementById('member-chip').textContent = result.member.name + ' — ' + result.member.code;
  loadDashboard();
}

/* Try ATH/FCT/120726/0143 as the demo ID */

/* ---------- Dashboard (Udemy-style catalog) ---------- */
async function loadDashboard() {
  const courses = await API.getCourses();
  const grid = document.getElementById('course-grid');
  grid.innerHTML = '';
  courses.forEach(c => {
    const progress = Progress.load(state.member.code, c.id);
    const pct = Math.round((progress.completedLessons.length / c.lessonCount) * 100);
    let pillClass = '', pillText = 'Not started';
    if (progress.locked) { pillClass = 'locked'; pillText = 'Locked'; }
    else if (pct === 100) { pillClass = 'progress'; pillText = 'Ready for assessment'; }
    else if (pct > 0) { pillClass = 'progress'; pillText = `${pct}% done`; }

    const card = document.createElement('div');
    card.className = 'catalog-card';
    card.innerHTML = `
      <div class="catalog-thumb">${c.thumb ? `<img src="${c.thumb}" alt="${c.title}">` : `<span class="initials">${c.initials || c.tag.slice(0,2).toUpperCase()}</span>`}</div>
      <div class="catalog-body">
        <div class="tag">${c.tag}</div>
        <h3>${c.title}</h3>
        <p>${c.blurb}</p>
        <div class="catalog-meta">
          <span>${c.lessonCount} lessons</span>
          <span class="status-pill ${pillClass}">${pillText}</span>
        </div>
      </div>`;
    card.addEventListener('click', () => openOverview(c.id));
    grid.appendChild(card);
  });
  showScreen('screen-dashboard');
}
document.getElementById('cert-back-to-dash').addEventListener('click', loadDashboard);

/* ---------- Course overview (Udemy-style detail page) ---------- */
async function openOverview(courseId) {
  state.currentCourse = await API.getCourse(courseId);
  const course = state.currentCourse;
  const progress = Progress.load(state.member.code, course.id);
  const pct = Math.round((progress.completedLessons.length / course.lessons.length) * 100);

  document.getElementById('ov-tag').textContent = course.tag;
  document.getElementById('ov-title').textContent = course.title;
  document.getElementById('ov-blurb').textContent = course.blurb;
  document.getElementById('ov-learn').innerHTML = (course.learn || []).map(l => `<li>${l}</li>`).join('');
  document.getElementById('ov-curriculum').innerHTML = course.lessons.map((l, i) =>
    `<li><span><span class="lnum">${String(i+1).padStart(2,'0')}</span>${l.title}</span>${progress.completedLessons.includes(l.id) ? '✓' : ''}</li>`
  ).join('');

  const box = document.getElementById('ov-progress-box');
  const startBtn = document.getElementById('ov-start');
  if (progress.locked && pct < 100) {
    box.innerHTML = `Locked after your last attempt.<div class="rung--full" style="--pct:${pct}%;"></div>${pct}% through a fresh pass`;
    startBtn.textContent = 'Continue course';
  } else if (pct === 100) {
    box.innerHTML = `All lessons complete.<div class="rung--full" style="--pct:100%;"></div>Ready for the assessment`;
    startBtn.textContent = 'Go to assessment';
  } else if (pct > 0) {
    box.innerHTML = `In progress.<div class="rung--full" style="--pct:${pct}%;"></div>${pct}% complete`;
    startBtn.textContent = 'Continue course';
  } else {
    box.innerHTML = `Not started yet.<div class="rung--full" style="--pct:0%;"></div>`;
    startBtn.textContent = 'Start course';
  }
  startBtn.onclick = () => openCourse(course.id);

  showScreen('screen-overview');
}
document.getElementById('back-to-overview').addEventListener('click', () => openOverview(state.currentCourse.id));
document.getElementById('overview-back').addEventListener('click', loadDashboard);

/* ---------- Lesson / ladder ---------- */
async function openCourse(courseId) {
  state.currentCourse = await API.getCourse(courseId);
  const saved = Progress.load(state.member.code, courseId);
  state.completedLessons = new Set(saved.completedLessons);
  state.locked = saved.locked;
  // Resume at the first lesson not yet marked complete.
  const firstIncomplete = state.currentCourse.lessons.findIndex(l => !state.completedLessons.has(l.id));
  state.lessonIndex = firstIncomplete === -1 ? state.currentCourse.lessons.length - 1 : firstIncomplete;
  renderLesson();
  showScreen('screen-lesson');
}

function persistProgress() {
  Progress.save(state.member.code, state.currentCourse.id, {
    completedLessons: Array.from(state.completedLessons),
    locked: state.locked
  });
}

function renderLesson() {
  const course = state.currentCourse;
  const lesson = course.lessons[state.lessonIndex];
  document.getElementById('lesson-title').textContent = lesson.title;
  document.getElementById('lesson-count').textContent = `Lesson ${state.lessonIndex + 1} of ${course.lessons.length}`;
  document.getElementById('lesson-desc').textContent = lesson.desc;
  document.getElementById('video-frame').src = `https://www.youtube.com/embed/${lesson.youtubeId}`;
  document.getElementById('prev-lesson').disabled = state.lessonIndex === 0;

  const nextBtn = document.getElementById('next-lesson');
  const isLast = state.lessonIndex === course.lessons.length - 1;
  nextBtn.textContent = state.completedLessons.has(lesson.id)
    ? (isLast ? 'Completed ✓' : 'Next lesson →')
    : 'Mark complete & continue →';

  const rail = document.getElementById('rung-list');
  rail.innerHTML = '';
  course.lessons.forEach((l, i) => {
    const item = document.createElement('div');
    const done = state.completedLessons.has(l.id);
    const current = i === state.lessonIndex;
    item.className = 'rung-item' + (done ? ' done' : '') + (current ? ' current' : '');
    item.textContent = `${i + 1}. ${l.title}`;
    item.addEventListener('click', () => { state.lessonIndex = i; renderLesson(); });
    rail.appendChild(item);
  });

  const allDone = course.lessons.every(l => state.completedLessons.has(l.id));
  const assessBtn = document.getElementById('start-assessment');
  const note = document.querySelector('.assess-note');
  if (state.locked && allDone) {
    assessBtn.disabled = false;
    assessBtn.textContent = 'Take assessment (retry unlocked)';
    note.textContent = 'You have completed the course again. One attempt, 50 minutes, 90% weighted pass mark.';
  } else if (state.locked) {
    assessBtn.disabled = true;
    assessBtn.textContent = 'Locked — finish the course again';
    note.textContent = 'Your last attempt did not reach 90%. Go through every lesson again to unlock a new attempt.';
  } else {
    assessBtn.disabled = !allDone;
    assessBtn.textContent = 'Take assessment';
    note.textContent = 'Unlocks once every lesson is marked complete. 20 questions, 50-minute limit, one attempt. Pass mark: 90%.';
  }
}

document.getElementById('prev-lesson').addEventListener('click', () => {
  if (state.lessonIndex > 0) { state.lessonIndex--; renderLesson(); }
});
document.getElementById('next-lesson').addEventListener('click', () => {
  const course = state.currentCourse;
  const lesson = course.lessons[state.lessonIndex];
  state.completedLessons.add(lesson.id);
  persistProgress();
  if (state.lessonIndex < course.lessons.length - 1) {
    state.lessonIndex++;
  }
  renderLesson();
});
document.getElementById('start-assessment').addEventListener('click', startAssessment);

/* ---------- Assessment ---------- */
function warnBeforeUnload(e) {
  e.preventDefault();
  e.returnValue = '';
}

async function startAssessment() {
  const { assessmentId, questions } = await API.getAssessment(state.currentCourse.id);
  state.quiz = {
    assessmentId, questions, index: 0, answers: [], selectedOption: null,
    secondsLeft: ASSESSMENT_SECONDS, timer: null
  };
  document.getElementById('quiz-course-title').textContent = state.currentCourse.title;
  window.addEventListener('beforeunload', warnBeforeUnload);
  startTimer();
  renderQuestion();
  showScreen('screen-quiz');
}

function startTimer() {
  updateTimerLabel();
  state.quiz.timer = setInterval(() => {
    state.quiz.secondsLeft--;
    updateTimerLabel();
    if (state.quiz.secondsLeft <= 0) {
      clearInterval(state.quiz.timer);
      finishAssessment(true); // timed out
    }
  }, 1000);
}

function updateTimerLabel() {
  const s = Math.max(0, state.quiz.secondsLeft);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  const label = document.getElementById('quiz-timer');
  if (label) {
    label.textContent = `${mm}:${ss}`;
    label.classList.toggle('quiz-timer--low', s <= 120);
  }
}

function renderQuestion() {
  const { questions, index } = state.quiz;
  const q = questions[index];
  state.quiz.selectedOption = null;

  document.getElementById('quiz-progress-label').textContent = `Question ${index + 1} / ${questions.length}`;
  document.getElementById('quiz-progress-bar').style.setProperty('--pct', `${((index) / questions.length) * 100}%`);
  document.getElementById('q-text').textContent = q.q;
  document.getElementById('quiz-weight-label').textContent = `Worth ${q.weight} point${q.weight > 1 ? 's' : ''}`;

  const optWrap = document.getElementById('q-options');
  optWrap.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D', 'E'];
  q.options.forEach((opt, i) => {
    const div = document.createElement('div');
    div.className = 'option';
    div.innerHTML = `<span class="letter">${letters[i]}</span><span>${opt.text}</span>`;
    div.addEventListener('click', () => {
      document.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
      div.classList.add('selected');
      state.quiz.selectedOption = i;
      document.getElementById('submit-answer').disabled = false;
    });
    optWrap.appendChild(div);
  });
  document.getElementById('submit-answer').disabled = true;
  document.getElementById('submit-answer').textContent = index === questions.length - 1 ? 'Finish assessment' : 'Next question →';
}

document.getElementById('submit-answer').addEventListener('click', () => {
  const { questions, index, selectedOption } = state.quiz;
  const q = questions[index];
  state.quiz.answers.push({ correct: q.options[selectedOption].isCorrect, weight: q.weight });

  if (index < questions.length - 1) {
    state.quiz.index++;
    renderQuestion();
  } else {
    finishAssessment(false);
  }
});

function finishAssessment(timedOut) {
  clearInterval(state.quiz.timer);
  window.removeEventListener('beforeunload', warnBeforeUnload);

  // Any question left unanswered because of a timeout counts as wrong.
  const { questions, answers } = state.quiz;
  while (answers.length < questions.length) {
    answers.push({ correct: false, weight: questions[answers.length].weight });
  }

  const totalWeight = answers.reduce((s, a) => s + a.weight, 0);
  const earnedWeight = answers.reduce((s, a) => s + (a.correct ? a.weight : 0), 0);
  const pct = Math.round((earnedWeight / totalWeight) * 100);
  const passed = pct >= PASS_MARK;

  API.recordAttempt({
    memberCode: state.member.code,
    memberName: state.member.name,
    memberEmail: state.member.email || '',
    courseId: state.currentCourse.id,
    courseTitle: state.currentCourse.title,
    passed, score: pct
  });

  document.getElementById('result-badge').textContent = passed ? 'Passed' : 'Not this time';
  document.getElementById('result-badge').className = 'result-badge ' + (passed ? 'pass' : 'fail');
  document.getElementById('result-heading').textContent = passed
    ? 'You cleared the bar. Generating your certificate…'
    : (timedOut ? 'Time ran out before you finished.' : "You gave it a real shot — that's what counts.");
  document.getElementById('result-score').textContent = `Weighted score: ${pct}% (pass mark ${PASS_MARK}%)`;

  const actions = document.getElementById('result-actions');
  actions.innerHTML = '';
  if (passed) {
    // Certificates are automatic — no button to click, per spec.
    generateCertificate(pct);
  } else {
    state.locked = true;
    state.completedLessons.clear();
    persistProgress();
    const p = document.createElement('p');
    p.style.cssText = 'color:var(--muted); margin-bottom:24px; max-width:520px;';
    p.textContent = "There are no retakes on this attempt, but the door isn't closed. Go through the course again from the start, and a fresh attempt unlocks once every lesson is complete.";
    actions.parentNode.insertBefore(p, actions);
    const back = document.createElement('button');
    back.textContent = 'Restart the course';
    back.addEventListener('click', () => { state.lessonIndex = 0; renderLesson(); showScreen('screen-lesson'); });
    actions.appendChild(back);
  }
  showScreen('screen-result');
}

/* ---------- Certificate ---------- */
const LOGO_ATH = new Image();
LOGO_ATH.src = 'assets/ath-badge.png';
const LOGO_TRACTION = new Image();
LOGO_TRACTION.src = 'assets/traction-outsourcing-logo.png';

function waitForImages() {
  const ready = img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = res; img.onerror = res; });
  return Promise.all([ready(LOGO_ATH), ready(LOGO_TRACTION)]);
}

async function generateCertificate(pct) {
  await waitForImages();
  const certId = await drawAndIssueCertificate(pct);
  buildShareLinks(state.currentCourse.title, certId);
  document.getElementById('cert-sub').innerHTML =
    `Certificate ID <strong>${certId}</strong> — anyone can check it at ` +
    `<a href="verify.html?id=${certId}" style="color:var(--orange)" target="_blank">tolnigeria.com/ath-academy/verify</a>. ` +
    (state.member.email ? `A copy has also been emailed to you.` : ``);
  showScreen('screen-cert');
}

async function drawAndIssueCertificate(pct) {
  const { certId } = await API.issueCertificate({
    memberCode: state.member.code,
    memberName: state.member.name,
    memberEmail: state.member.email || '',
    courseId: state.currentCourse.id,
    courseTitle: state.currentCourse.title,
    score: pct,
    date: new Date().toISOString()
  });

  drawCertificate(state.member.name, state.member.code, state.currentCourse.title, certId);

  if (state.member.email) {
    const canvas = document.getElementById('cert-canvas');
    API.emailCertificate({
      certId,
      memberEmail: state.member.email,
      memberName: state.member.name,
      courseTitle: state.currentCourse.title,
      imageBase64: canvas.toDataURL('image/png')
    });
  }

  return certId;
}

function drawCertificate(name, memberCode, courseTitle, certId) {
  const canvas = document.getElementById('cert-canvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  ctx.fillStyle = '#14110F';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#E35F26';
  ctx.lineWidth = 6;
  ctx.strokeRect(30, 30, W - 60, H - 60);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.strokeRect(48, 48, W - 96, H - 96);

  // Logo row — ATH Recruiters badge on the left, Traction Outsourcing
  // wordmark on the right. Traction's logo has a black icon dot and dark
  // "Outsourcing" text that read poorly on the near-black background, so it
  // sits on a small white plate; the ATH badge is already transparent and
  // reads fine directly on black.
  const athH = 64;
  const athW = LOGO_ATH.naturalWidth ? (LOGO_ATH.naturalWidth / LOGO_ATH.naturalHeight) * athH : athH;
  if (LOGO_ATH.complete && LOGO_ATH.naturalWidth) ctx.drawImage(LOGO_ATH, 80, 62, athW, athH);

  const tracH = 40;
  const tracW = LOGO_TRACTION.naturalWidth ? (LOGO_TRACTION.naturalWidth / LOGO_TRACTION.naturalHeight) * tracH : tracH * 4;
  const plateX = W - 80 - tracW - 20, plateY = 68, plateW = tracW + 40, plateH = tracH + 24;
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, plateX, plateY, plateW, plateH, 4);
  ctx.fill();
  if (LOGO_TRACTION.complete && LOGO_TRACTION.naturalWidth) {
    ctx.drawImage(LOGO_TRACTION, plateX + 20, plateY + 12, tracW, tracH);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#8A8377';
  ctx.font = '400 16px Archivo, sans-serif';
  ctx.fillText('CERTIFICATE OF COMPLETION', W / 2, 195);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 52px Archivo, sans-serif';
  ctx.fillText(name, W / 2, 340);

  ctx.fillStyle = '#8A8377';
  ctx.font = '400 15px "IBM Plex Mono", monospace';
  ctx.fillText(memberCode, W / 2, 375);

  ctx.fillStyle = '#8A8377';
  ctx.font = '400 18px Archivo, sans-serif';
  ctx.fillText('has completed', W / 2, 420);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 30px Archivo, sans-serif';
  wrapText(ctx, courseTitle, W / 2, 470, W - 240, 38);

  ctx.fillStyle = '#8A8377';
  ctx.font = '400 15px "IBM Plex Mono", monospace';
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  ctx.fillText(dateStr, W / 2, H - 140);
  ctx.font = '700 16px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#E35F26';
  ctx.fillText('Certificate No. ' + certId, W / 2, H - 108);
  ctx.font = '400 14px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#8A8377';
  ctx.fillText('Verify at tolnigeria.com/ath-academy/verify', W / 2, H - 82);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '', lines = [];
  words.forEach(w => {
    const test = line + w + ' ';
    if (ctx.measureText(test).width > maxWidth && line !== '') {
      lines.push(line); line = w + ' ';
    } else { line = test; }
  });
  lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l.trim(), x, startY + i * lineHeight));
}

document.getElementById('cert-download').addEventListener('click', () => {
  const canvas = document.getElementById('cert-canvas');
  const link = document.createElement('a');
  link.download = 'ath-academy-certificate.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

function buildShareLinks(courseTitle, certId) {
  const shareText = encodeURIComponent(`I just earned my ${courseTitle} certificate from ATH Academy. Certificate No. ${certId} — verify at tolnigeria.com/ath-academy/verify`);
  const shareUrl = encodeURIComponent(`https://tolnigeria.com/ath-academy/verify.html?id=${certId}`);
  const row = document.getElementById('share-row');
  row.innerHTML = `
    <a href="https://wa.me/?text=${shareText}%20${shareUrl}" target="_blank">Share on WhatsApp</a>
    <a href="https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}" target="_blank">Share on LinkedIn</a>
    <a href="#" id="copy-caption">Copy caption for TikTok / Instagram</a>
  `;
  document.getElementById('copy-caption').addEventListener('click', (e) => {
    e.preventDefault();
    navigator.clipboard.writeText(decodeURIComponent(shareText));
    e.target.textContent = 'Copied — paste it into your post';
  });
}
