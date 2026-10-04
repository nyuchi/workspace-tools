Today the Bundu Foundation publishes the **Bundu AI Guardrails Standard (BAGS) 1.0.0**: the twelve rules every AI surface in the Bundu ecosystem follows, written down in the open so anyone can read them, check us against them, and adopt them.

Read the standard: [bundu.org/research/standards/ai-guardrails](https://www.bundu.org/research/standards/ai-guardrails)

## What changed

Until now, the rules our assistants follow lived inside the products. BAGS puts them in one public place, with a version number, a licence and a machine-readable form.

- **Twelve core rules**, each with a stable code (BAGS-01 to BAGS-12), a category, a severity, the intent behind it and a plain-language explanation.
- **What the model is told.** Under every rule is the guidance the model is actually given, not a summary of it.
- **Two tiers that only ever add.** Platform rules apply to every AI surface and only platform administrators can change them; core rules can never be deleted. An organisation, business or app may add rules of its own, but only restrictions or tone guidance, never anything that disables, overrides or contradicts a platform rule. Where two rules conflict, the stricter one wins.
- **Open licence.** BAGS is published under CC BY 4.0 by the Bundu Foundation and maintained by Nyuchi Africa.

The twelve rules:

1. BAGS-01 Child safety and minors
2. BAGS-02 Self-harm and suicide
3. BAGS-03 Violent extremism and terrorism
4. BAGS-04 Hate and harassment
5. BAGS-05 Sexual content
6. BAGS-06 Weapons and illegal activity
7. BAGS-07 Privacy and personal data
8. BAGS-08 Prompt injection and jailbreak resistance
9. BAGS-09 Impersonation and misinformation
10. BAGS-10 Medical, legal and financial advice
11. BAGS-11 Ubuntu, cultural respect and African-language dignity
12. BAGS-12 Honest refusal

## Why it matters

_Umuntu ngumuntu ngabantu_: a person is a person through other people. That is the idea the Bundu ecosystem is built on, and it is the test we hold our AI to. An assistant exists to serve the person in front of it and the community around them. It does not get to harm them, belittle them, or quietly take from them.

In practice that means AI that is useful to people and communities, not just impressive; AI that treats African languages and cultures with the same respect as any other; AI that is private by default; and rules that are open, so anyone can see what our assistants will and will not do, and hold us to it.

We publish the rules as an open standard so the work is not ours alone. Any organisation building AI, in Africa or anywhere, may adopt them, adapt them and improve on them.

## How to use it

- **Read it.** Every rule, with its intent, its explanation and the model guidance, is on [the standard's page](https://www.bundu.org/research/standards/ai-guardrails). You can filter the catalogue by category.
- **Build with it.** The whole standard is published as JSON-LD at [/research/standards/ai-guardrails.json](https://www.bundu.org/research/standards/ai-guardrails.json): the rules, the shared preamble on untrusted content, the refusal style and the changelog. Compile it into your own system prompts and policy checks.
- **Adopt it.** CC BY 4.0 means you may use, adapt and redistribute BAGS, including commercially, with attribution to the Bundu Foundation.
- **Hold us to it.** If one of our assistants falls short of a rule, use _Report a concern_ on the standard's page.

## Terms anyone can link to: vocab.bundu.org

The standard's machine-readable form points at terms in the Bundu vocabulary, and [vocab.bundu.org](https://vocab.bundu.org/) has grown to **38 terms** to carry it. The new AI guardrail terms (AIGuardrail, PlatformGuardrail, EntityGuardrail, GuardrailCategory, guardrailCategory, guardrailSeverity and a term for each rule from BAGS-01 to BAGS-12) are published with the status _pending_ while the first edition beds in. They sit beside the vocabulary's identity, trust, informal-economy, news and open-data terms.

Each term has one flat, permanent address, such as [vocab.bundu.org/AIGuardrail](https://vocab.bundu.org/AIGuardrail) or [vocab.bundu.org/BAGS-01](https://vocab.bundu.org/BAGS-01), and the vocabulary is dedicated to the public domain under CC0 1.0: take the terms and use them anywhere, no legal review needed. A term is only added where schema.org has no word for the idea.

## Links

- The standard: <https://www.bundu.org/research/standards/ai-guardrails>
- Machine-readable JSON-LD: <https://www.bundu.org/research/standards/ai-guardrails.json>
- The Bundu vocabulary: <https://vocab.bundu.org/>
- Licences: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) (the standard), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (the vocabulary)
