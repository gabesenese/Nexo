import "dotenv/config";
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_SLUG = "meridian-demo";
const DEMO_WIDGET_KEY = "demo_meridian";
const DEMO_EMAIL = "demo@meridian.test";
const DEMO_PASSWORD = "demo-password";

const WEEKS = 8;
const CONVERSATIONS = 130;

/**
 * This seed fabricates support traffic, which is only ever acceptable in a
 * development database. Running it against production would put invented
 * conversations in front of a real customer, so the guard below is a hard
 * stop rather than a warning.
 */
function assertDevelopmentDatabase() {
  const url = process.env.DATABASE_URL ?? "";

  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed demo traffic with NODE_ENV=production.");
  }

  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }

  const isLocal = /@(localhost|127\.0\.0\.1|host\.docker\.internal|postgres)[:/]/.test(url);
  if (!isLocal) {
    throw new Error(
      `Refusing to seed demo traffic into a non-local database (${url.replace(/:[^:@]*@/, ":***@")}). ` +
        `This seed invents conversations and must never touch real data.`,
    );
  }
}

/** Seeded PRNG so repeated runs produce byte-identical data and QA is reproducible. */
function mulberry32(seed: number) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(20260809);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

function randomInt(min: number, max: number) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function round(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

type SourceSpec = {
  name: string;
  type: "help_center" | "pdf";
  origin: string;
  headings: string[][];
};

const SOURCE_SPECS: SourceSpec[] = [
  {
    name: "Meridian Help Center",
    type: "help_center",
    origin: "https://help.meridian.test",
    headings: [
      ["Getting started", "Create your first invoice"],
      ["Getting started", "Invite your team"],
      ["Billing", "Change your plan"],
      ["Billing", "Update a payment method"],
      ["Invoices", "Send a reminder"],
      ["Invoices", "Void an invoice"],
      ["Integrations", "Connect Stripe"],
    ],
  },
  {
    name: "Billing FAQ",
    type: "pdf",
    origin: "billing-faq.pdf",
    headings: [
      ["Plans and pricing", "Seat counting"],
      ["Plans and pricing", "Annual discounts"],
      ["Taxes", "VAT and reverse charge"],
    ],
  },
  {
    name: "API Reference",
    type: "help_center",
    origin: "https://api.meridian.test/docs",
    headings: [
      ["Authentication", "API keys"],
      ["Endpoints", "Create an invoice"],
      ["Endpoints", "List customers"],
      ["Rate limits", "Burst limits"],
    ],
  },
];

/**
 * Topics the seeded knowledge base genuinely covers. The AI answers these
 * with citations and high confidence.
 */
const COVERED_TOPICS: { question: string; answer: string; source: string; heading: string[] }[] = [
  {
    question: "How do I create my first invoice?",
    answer:
      "Open Invoices and choose New invoice. Pick a customer, add line items, then Send. The invoice is emailed and appears in the customer's portal immediately.",
    source: "Meridian Help Center",
    heading: ["Getting started", "Create your first invoice"],
  },
  {
    question: "Can I change my plan mid-cycle?",
    answer:
      "Yes. Go to Settings then Billing and choose Change plan. Upgrades take effect immediately and are prorated; downgrades apply at the start of your next cycle.",
    source: "Meridian Help Center",
    heading: ["Billing", "Change your plan"],
  },
  {
    question: "How do I update the card on file?",
    answer:
      "Settings then Billing then Payment method. Adding a new card replaces the old one at the next charge, and any failed invoice is retried within an hour.",
    source: "Meridian Help Center",
    heading: ["Billing", "Update a payment method"],
  },
  {
    question: "How do I send a payment reminder?",
    answer:
      "Open the invoice and choose Send reminder. You can also enable automatic reminders at 3, 7, and 14 days past due under Settings then Invoices.",
    source: "Meridian Help Center",
    heading: ["Invoices", "Send a reminder"],
  },
  {
    question: "How do I void an invoice that was sent by mistake?",
    answer:
      "Open the invoice, choose More then Void. Voiding keeps the record for your audit trail but removes the amount from receivables and notifies the customer.",
    source: "Meridian Help Center",
    heading: ["Invoices", "Void an invoice"],
  },
  {
    question: "How are seats counted on the team plan?",
    answer:
      "A seat is any member who can sign in. Members you deactivate stop counting at the next billing cycle, and billing-only contacts are free.",
    source: "Billing FAQ",
    heading: ["Plans and pricing", "Seat counting"],
  },
  {
    question: "Do you offer a discount for annual billing?",
    answer: "Annual billing is 2 months free compared to paying monthly. You can switch from Settings then Billing.",
    source: "Billing FAQ",
    heading: ["Plans and pricing", "Annual discounts"],
  },
  {
    question: "Where do I find my API key?",
    answer:
      "Settings then Developers then API keys. Keys are shown once at creation. Rotating a key keeps the previous one valid for 24 hours so you can migrate.",
    source: "API Reference",
    heading: ["Authentication", "API keys"],
  },
  {
    question: "What are the API rate limits?",
    answer:
      "The default limit is 100 requests per minute per key, with a burst allowance of 200. Exceeding it returns 429 with a Retry-After header.",
    source: "API Reference",
    heading: ["Rate limits", "Burst limits"],
  },
  {
    question: "How do I connect Stripe?",
    answer:
      "Settings then Integrations then Stripe, then authorize. Once connected, paid invoices reconcile automatically and payouts appear on your Stripe dashboard.",
    source: "Meridian Help Center",
    heading: ["Integrations", "Connect Stripe"],
  },
  {
    question: "How do I invite a teammate?",
    answer:
      "Settings then Members then Invite. They get an email link that expires in 7 days. You can choose owner, admin, or member when inviting.",
    source: "Meridian Help Center",
    heading: ["Getting started", "Invite your team"],
  },
  {
    question: "Do you charge VAT for EU customers?",
    answer:
      "We charge VAT unless you supply a valid EU VAT number, in which case the reverse charge applies. Add it under Settings then Billing then Tax details.",
    source: "Billing FAQ",
    heading: ["Taxes", "VAT and reverse charge"],
  },
];

/**
 * Topics no seeded source covers. These are the knowledge gaps: the AI
 * retrieves nothing relevant, confidence lands below threshold, and the
 * conversation escalates. Clustering here is the signal the Knowledge Gaps
 * view is meant to surface.
 */
const UNCOVERED_TOPICS: { question: string; attempt: string; gap: string }[] = [
  {
    question: "How do I set up SAML single sign-on with Okta?",
    attempt:
      "I can point you to team member invitations, but I don't have documentation covering SAML or Okta configuration.",
    gap: "SSO / SAML",
  },
  {
    question: "Can we enforce SSO for everyone in the workspace?",
    attempt: "I don't have anything in my sources about enforcing single sign-on.",
    gap: "SSO / SAML",
  },
  {
    question: "Which region is our data stored in, and can we choose EU-only?",
    attempt: "I don't have documentation on data residency or region selection.",
    gap: "Data residency",
  },
  {
    question: "Are you GDPR compliant and can you sign a DPA?",
    attempt: "I don't have a source covering GDPR commitments or data processing agreements.",
    gap: "Data residency",
  },
  {
    question: "What is your refund policy if we cancel halfway through the year?",
    attempt:
      "I can explain how plan changes are prorated, but I don't have a source covering refunds on annual contracts.",
    gap: "Refunds and cancellation",
  },
  {
    question: "Can I get a refund for the seats we didn't use last quarter?",
    attempt: "I don't have documentation about refunds for unused seats.",
    gap: "Refunds and cancellation",
  },
  {
    question: "How many times do webhooks retry before you give up?",
    attempt:
      "I can describe the API endpoints, but I don't have anything covering webhook delivery or retry behaviour.",
    gap: "Webhooks",
  },
  {
    question: "Is there a way to replay a failed webhook delivery?",
    attempt: "I don't have a source describing webhook replay.",
    gap: "Webhooks",
  },
  {
    question: "Do you have a SOC 2 report we can share with our security team?",
    attempt: "I don't have documentation covering SOC 2 or security certifications.",
    gap: "Security review",
  },
  {
    question: "Can you fill out our vendor security questionnaire?",
    attempt: "I don't have a source covering security questionnaires.",
    gap: "Security review",
  },
];

/** Requests where the customer skips the AI entirely and asks for a person. */
const HUMAN_REQUESTS = [
  "I'd rather talk to a person about this.",
  "Can you connect me with someone on your team?",
  "This is urgent, I need a human please.",
  "Please put me through to support.",
];

const AGENT_REPLIES = [
  "Thanks for waiting. I've looked into this and I'm taking care of it now.",
  "I can help with that. I've applied the change on our side, you should see it within a few minutes.",
  "Good question, this one isn't documented yet. Here's how it works, and I'll get it written up.",
  "I've escalated this to our billing team and will follow up here as soon as I hear back.",
  "Sorted. Let me know if anything still looks off on your end.",
];

const CUSTOMER_FOLLOW_UPS = [
  "That worked, thank you.",
  "Perfect, that's what I needed.",
  "Great, appreciate the quick reply.",
];

const REOPEN_MESSAGES = [
  "This started happening again today.",
  "Sorry to reopen this, but the issue is back.",
  "It worked for a day and then broke again.",
];

async function clearExistingDemoData(organizationId: string) {
  await prisma.notification.deleteMany({ where: { organizationId } });
  await prisma.escalation.deleteMany({ where: { conversation: { organizationId } } });
  await prisma.message.deleteMany({ where: { conversation: { organizationId } } });
  await prisma.conversation.deleteMany({ where: { organizationId } });
  await prisma.chunk.deleteMany({ where: { source: { organizationId } } });
  await prisma.source.deleteMany({ where: { organizationId } });
}

async function main() {
  assertDevelopmentDatabase();

  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS vector");
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS pg_trgm");

  const organization = await prisma.organization.upsert({
    where: { slug: DEMO_SLUG },
    update: { widgetKey: DEMO_WIDGET_KEY },
    create: { name: "Meridian (demo)", slug: DEMO_SLUG, widgetKey: DEMO_WIDGET_KEY },
  });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const owner = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { passwordHash },
    create: { email: DEMO_EMAIL, passwordHash, name: "Dana Reyes" },
  });

  const teammate = await prisma.user.upsert({
    where: { email: "sam@meridian.test" },
    update: {},
    create: { email: "sam@meridian.test", passwordHash, name: "Sam Okafor" },
  });

  for (const user of [owner, teammate]) {
    await prisma.membership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: organization.id } },
      update: {},
      create: {
        userId: user.id,
        organizationId: organization.id,
        role: user.id === owner.id ? "owner" : "agent",
      },
    });
  }

  await clearExistingDemoData(organization.id);

  const now = Date.now();
  const windowStart = now - WEEKS * 7 * 24 * 60 * 60 * 1000;

  const chunkIdBySourceHeading = new Map<string, string>();

  for (const spec of SOURCE_SPECS) {
    const source = await prisma.source.create({
      data: {
        organizationId: organization.id,
        type: spec.type,
        name: spec.name,
        origin: spec.origin,
        status: "ready",
        totalChunks: spec.headings.length,
        processedChunks: spec.headings.length,
        lastSyncedAt: new Date(now - randomInt(1, 6) * 24 * 60 * 60 * 1000),
        createdAt: new Date(windowStart - 2 * 24 * 60 * 60 * 1000),
      },
    });

    for (const heading of spec.headings) {
      const chunk = await prisma.chunk.create({
        data: {
          sourceId: source.id,
          content: `${heading.join(" › ")}: reference content for ${spec.name}.`,
          tokenCount: randomInt(90, 320),
          metadata: { headingPath: heading } as Prisma.InputJsonValue,
          createdAt: new Date(windowStart - 2 * 24 * 60 * 60 * 1000),
        },
      });
      chunkIdBySourceHeading.set(`${spec.name}::${heading.join("/")}`, chunk.id);
    }
  }

  const counts = {
    lowConfidence: 0,
    userRequested: 0,
    reopened: 0,
    pendingEscalations: 0,
  };

  for (let i = 0; i < CONVERSATIONS; i++) {
    /**
     * Weighting the window toward recent days keeps the trend line from
     * looking artificially flat, matching how a growing workspace behaves.
     */
    const skew = random() ** 0.7;
    const startedAt = new Date(windowStart + skew * (now - windowStart));

    /** Business hours, so response-time gaps are not distorted by overnight waits. */
    startedAt.setHours(randomInt(8, 18), randomInt(0, 59), randomInt(0, 59), 0);
    if (startedAt.getTime() > now) startedAt.setTime(now - randomInt(1, 90) * 60 * 1000);

    const sessionId = `demo-${(i + 1).toString().padStart(4, "0")}-${Math.floor(random() * 1e6).toString(36)}`;
    const roll = random();

    const conversation = await prisma.conversation.create({
      data: {
        organizationId: organization.id,
        sessionId,
        channel: "widget",
        status: "active",
        createdAt: startedAt,
      },
    });

    let cursor = startedAt.getTime();
    const step = (seconds: number) => new Date((cursor += seconds * 1000));

    if (roll < 0.6) {
      const topic = pick(COVERED_TOPICS);
      const chunkId = chunkIdBySourceHeading.get(`${topic.source}::${topic.heading.join("/")}`);
      const confidence = round(0.78 + random() * 0.2);

      await prisma.message.create({
        data: { conversationId: conversation.id, role: "user", content: topic.question, createdAt: step(0) },
      });
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: topic.answer,
          confidence,
          citations: [
            { id: chunkId ?? "unknown", sourceName: topic.source, headingPath: topic.heading },
          ] as Prisma.InputJsonValue,
          createdAt: step(randomInt(2, 6)),
        },
      });

      const resolvedAt = step(randomInt(20, 240));
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: "resolved", resolvedAt },
      });

      /** A resolution that did not hold: the customer returns on the same thread. */
      if (random() < 0.09) {
        const reopenedAt = step(randomInt(3600, 36 * 3600));
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: "user",
            content: pick(REOPEN_MESSAGES),
            createdAt: reopenedAt,
          },
        });
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            status: "active",
            reopenCount: 1,
            lastReopenedAt: reopenedAt,
          },
        });
        counts.reopened++;
      }
      continue;
    }

    const wantsHuman = roll < 0.72;
    const topic = wantsHuman ? null : pick(UNCOVERED_TOPICS);
    const question = wantsHuman ? pick(HUMAN_REQUESTS) : topic!.question;
    const reason = wantsHuman ? "user_requested" : "low_confidence";
    const confidence = wantsHuman ? null : round(0.14 + random() * 0.3);

    await prisma.message.create({
      data: { conversationId: conversation.id, role: "user", content: question, createdAt: step(0) },
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: wantsHuman ? "Connecting you with a human agent now." : topic!.attempt,
        confidence: confidence ?? undefined,
        citations: [] as Prisma.InputJsonValue,
        createdAt: step(randomInt(2, 7)),
      },
    });

    const summary =
      reason === "user_requested"
        ? "User explicitly requested a human agent."
        : `Low-confidence AI answer (confidence ${confidence!.toFixed(2)}); escalated instead of guessing.`;

    const escalatedAt = new Date(cursor);
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: "escalated" },
    });

    const answered = random() < 0.78;

    await prisma.escalation.create({
      data: {
        conversationId: conversation.id,
        reason,
        summary,
        status: answered ? "handed_off" : "pending",
        handoffPayload: { adapter: "mock", ticketId: `MOCK-${randomInt(1000, 9999)}` } as Prisma.InputJsonValue,
        createdAt: escalatedAt,
      },
    });

    await prisma.notification.create({
      data: {
        organizationId: organization.id,
        conversationId: conversation.id,
        type: "escalation",
        message: summary,
        createdAt: escalatedAt,
      },
    });

    if (!answered) {
      counts.pendingEscalations++;
      if (reason === "low_confidence") counts.lowConfidence++;
      else counts.userRequested++;
      continue;
    }

    const responder = random() < 0.6 ? owner : teammate;
    const assignedAt = step(randomInt(120, 3600));
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { assignedUserId: responder.id, assignedAt },
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "agent",
        content: pick(AGENT_REPLIES),
        authorUserId: responder.id,
        createdAt: step(randomInt(60, 5400)),
      },
    });

    if (random() < 0.85) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "user",
          content: pick(CUSTOMER_FOLLOW_UPS),
          createdAt: step(randomInt(60, 1800)),
        },
      });
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: "resolved", resolvedAt: step(randomInt(30, 600)) },
      });
    }

    if (reason === "low_confidence") counts.lowConfidence++;
    else counts.userRequested++;
  }

  const totals = {
    conversations: await prisma.conversation.count({ where: { organizationId: organization.id } }),
    escalations: await prisma.escalation.count({ where: { conversation: { organizationId: organization.id } } }),
    messages: await prisma.message.count({ where: { conversation: { organizationId: organization.id } } }),
    agentMessages: await prisma.message.count({
      where: { conversation: { organizationId: organization.id }, role: "agent" },
    }),
    resolved: await prisma.conversation.count({
      where: { organizationId: organization.id, resolvedAt: { not: null } },
    }),
  };

  console.log(`Demo workspace ready: ${organization.name} (slug: ${organization.slug})`);
  console.log(`  Sign in: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  Widget key: ${DEMO_WIDGET_KEY}`);
  console.log(`  ${WEEKS} weeks of traffic, ${totals.conversations} conversations, ${totals.messages} messages`);
  console.log(
    `  ${totals.escalations} escalations (${counts.lowConfidence} low confidence, ${counts.userRequested} user requested, ${counts.pendingEscalations} still pending)`,
  );
  console.log(`  ${totals.resolved} with a resolution timestamp, ${totals.agentMessages} human replies`);
  console.log(`  ${counts.reopened} resolutions that did not hold`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
