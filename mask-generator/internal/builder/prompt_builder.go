package builder

import (
	"fmt"
	"strings"

	"messenger/mask-generator/internal/analyser"
	"messenger/mask-generator/internal/loader"
)

// Prompt holds the two-part prompt sent to Ollama.
type Prompt struct {
	System string // style + rules — sets the LLM persona
	User   string // the original message to disguise
}

// Build constructs the Ollama prompt from the message analysis and cipher style.
//
// The system prompt instructs the model to write in the cipher's style.
// The user prompt asks for a single mask phrase that fits the original text
// in tone, urgency and length — without revealing its content.
func Build(a analyser.Analysis, c *loader.Cipher, originalText string) Prompt {
	system := buildSystem(a, c)
	user := buildUser(a, originalText)
	return Prompt{System: system, User: user}
}

func buildSystem(a analyser.Analysis, c *loader.Cipher) string {
	var b strings.Builder

	fmt.Fprintf(&b, "You are a creative writer in the style of \"%s\".\n", c.Name)
	fmt.Fprintf(&b, "Style description: %s\n\n", c.Style)

	if c.Rules != "" {
		fmt.Fprintf(&b, "Rules:\n%s\n\n", c.Rules)
	}

	b.WriteString("Task: write ONE short phrase that could plausibly appear in this style.\n")
	b.WriteString("The phrase must feel natural in the conversation — do NOT reveal the hidden message.\n")
	fmt.Fprintf(&b, "Tone: %s. Urgency: %s. Length hint: %s. Language: %s.\n",
		a.Tone, a.Urgency, a.Length, a.Language)
	b.WriteString("Output ONLY the phrase. No explanations, no quotes, no punctuation at start.")

	return b.String()
}

func buildUser(a analyser.Analysis, originalText string) string {
	return fmt.Sprintf(
		"Original message (do not reveal): \"%s\"\n"+
			"Write a %s, %s-urgency mask phrase in %s.",
		originalText, a.Length, a.Urgency, a.Language,
	)
}
