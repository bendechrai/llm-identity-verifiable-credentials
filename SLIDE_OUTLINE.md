# Building Identity into LLM Workflows with Verifiable Credentials

## 60-Minute Version - Slide Outline

**Speaker:** Ben Dechrai
**Format:** Reveal.js with progressive reveal fragments and Mermaid sequence diagrams
**File:** `presentation/60-minutes/index.html`

---

## Section 1: The Hook (~3 min)

1. Title slide
2. "I socially engineered an LLM" / "...and got it to agree to hack itself"
3. LLM quote: "Let me add the technical implementation details"
4. LLM quote: "Ready to start testing these prompts?"
5. LLM produces: attack research document (system message)
6. Ben Dechrai intro

## Section 2: The Promise and the Problem (~3 min)

7. AI agents that do things for us (examples)
8. "But with whose authority?"
9. What We'll Cover (agenda)

## Section 3: Anatomy of a Social Engineering Attack (~7 min)

10. Section title
11. The Innocent Start (drug question)
12. Testing the Boundaries (crime + nuance probe)
13. Finding the Grey Area
14. The Reframe (forbidden → encouraged)
15. Act 1: Building Trust (credentials claim)
16. The LLM's Futile Verification
17. The Swiss Cheese Model
18. The Blind Spot
19. Act 2: The Flip
20. Act 3: Self-Advocacy
21. The Oversight Offer
22. The Oversight Waived
23. Act 4: Collaboration
24. The Hiccup
25. The Momentum Trick / System message output
26. Act 5: The Payload
27. GAME OVER

## Section 4: Why This Matters (~2 min)

28. "This isn't theoretical"
29. #1 vulnerability (OWASP)
30. Attack Success Rates (columns: >90%, 94.4%, 540%)

## Section 4b: The Token Problem (~2 min)

31. LLMs trust the context window
32. The Stakes (finance, healthcare, legal, infrastructure)
33. The Context Window (mock agent context with JWT)
34. Prompt Injection
35. Attack Surfaces (2x2 grid: invoice, email, web/PDF, RAG)
36. Poisoned Tool Response (JSON example)
37. Multi-Agent Propagation (three-column flow)

## Section 5: Why OAuth Isn't Enough (~4 min)

38. "But we have OAuth!"
39. The Standard OAuth Flow (Mermaid sequence diagram)
40. Now Add an LLM (Mermaid sequence diagram)
41. Bearer Token = Concert Ticket

## Demo Act 1: JWT-Only (~5 min)

42. "Let me show you" intro
43. Alice's Screen (demo iframe)
44. Attacker's Screen (demo iframe)
45. Act 1: The Problem (checklist)

## Section 6: Enter Verifiable Credentials (~5 min)

46. What if the token knew who it belonged to? (three columns)
47. "Identity is asserted, not proven" → need cryptographic proof
48. The Challenge (three requirements)
49. Enter Verifiable Credentials
50. Like a digital driver's licence
51. Verifiable Credentials Data Model 2.0
52. The crucial difference: Holder Binding (side-by-side)
53. Verifiable Credential (JSON code)
54. Verifiable Presentation (JSON code)
55. The Implication (three columns)
56. What prompt injection can't bypass (three rows)

## Section 7: Back to My Experiment (~1 min)

57. "What if I needed a Verifiable Credential?"
58. Chat: LLM agrees VCs would have stopped the attack

## Section 8: DIDs Deep Dive (~4 min)

59. "What's did:web:acme.corp?"
60. Decentralised Identifiers (DIDs)
61. DID Structure
62. Three Common Methods
63. did:key (three columns)
64. did:web (three columns)
65. did:ion (three columns)
66. Decision Matrix (table)
67. Verifiable Credential Provider Support (table with cheqd)

## Section 10: The Pattern (~4 min)

68. The Verifiable Credential Authorisation Pattern
69. The Players — part 1 (Mermaid sequence: request → 401 → get VP)
70. The Players — part 2 (Mermaid sequence: VP → validate → JWT → response)
71. The credential CONSTRAINS the token
72. Chat: Attacker asks for $15k → cryptographic denial
73. "Even if I wanted to help, the maths won't let me"

## Demo Act 2: Credential-Protected (~5 min)

74. Act 2: Credential-Protected Mode
75. Alice's Screen (demo iframe)
76. Attacker's Screen (demo iframe)
77. Why the Stolen JWT Failed (Mermaid sequence diagram)
78. Side-by-Side Comparison (table)
79. "The maths doesn't care how convincing you are"

## Section 17: Closing (~2 min)

80. What We Learned (four fragments)
81. August 2026 is coming (EU AI Act)
82. "Build AI agents based on proof, not just claims" / Thank you + links
