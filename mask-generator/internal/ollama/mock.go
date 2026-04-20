package ollama

import (
	"context"
	"strings"

	"messenger/mask-generator/internal/builder"
)

// MockClient returns deterministic stub masks without calling Ollama.
// Activated when MOCK_MASKS=true — allows running without a GPU or internet.
type MockClient struct{}

var stubs = []string{
	"The owl post arrived just before midnight, carrying urgent tidings from afar.",
	"Per our earlier discussion, please find the deliverable attached for your review.",
	"Hey, checking in — let me know when you're around!",
	"A strange hush fell over the common room as the enchanted ceiling flickered.",
	"Looking forward to connecting and aligning on the next steps together.",
}

func (m *MockClient) IsMock() bool { return true }

func (m *MockClient) Generate(_ context.Context, p builder.Prompt) (string, error) {
	switch {
	case strings.Contains(p.System, "harry_potter"):
		return stubs[0], nil
	case strings.Contains(p.System, "business"):
		return stubs[1], nil
	case strings.Contains(p.System, "casual"):
		return stubs[2], nil
	default:
		return stubs[len(p.User)%len(stubs)], nil
	}
}
