package builder

import (
	"fmt"
	"strings"

	"messenger/mask-generator/internal/analyser"
	"messenger/mask-generator/internal/loader"
)

// Prompt holds the two-part prompt sent to Ollama.
type Prompt struct {
	System string
	User   string
}

// DialogueTurn is one message in the cover conversation history.
type DialogueTurn struct {
	Mask     string
	Outgoing bool // true = sent by the local user ("A"), false = received ("B")
}

func Build(a analyser.Analysis, c *loader.Cipher, originalText string, history []DialogueTurn, outgoing bool) Prompt {
	return Prompt{
		System: buildSystem(c, history, outgoing, a.Language),
		User:   buildUser(a, originalText),
	}
}

func buildSystem(c *loader.Cipher, history []DialogueTurn, outgoing bool, lang string) string {
	var b strings.Builder

	// Who are A and B in this cover chat
	speakerLabel := "A"
	if !outgoing {
		speakerLabel = "B"
	}

	fmt.Fprintf(&b, "You are a character in \"%s\".\n", c.Name)
	fmt.Fprintf(&b, "Style: %s\n\n", c.Style)

	if c.Rules != "" {
		fmt.Fprintf(&b, "Rules for this style:\n%s\n\n", c.Rules)
	}

	if len(history) > 0 {
		b.WriteString("Dialogue so far:\n")
		for _, t := range history {
			role := "B"
			if t.Outgoing {
				role = "A"
			}
			fmt.Fprintf(&b, "%s: %s\n", role, t.Mask)
		}
		fmt.Fprintf(&b, "\nNow write the next message from speaker %s.\n", speakerLabel)
		b.WriteString("It MUST be a direct, natural reply to the previous message — like a real person would respond.\n")
		b.WriteString("Keep the topic and mood consistent with the conversation above.\n")
	} else {
		fmt.Fprintf(&b, "Write the opening message from speaker %s to start a natural conversation.\n", speakerLabel)
	}

	fmt.Fprintf(&b, "Language: %s. Output ONLY the message text — no labels, no quotes, no explanations.", lang)
	return b.String()
}

func buildUser(a analyser.Analysis, _ string) string {
	return fmt.Sprintf(
		"Write ONE natural reply of %s length with %s tone. Stay in character — no labels, no quotes.",
		a.Length, a.Tone,
	)
}
