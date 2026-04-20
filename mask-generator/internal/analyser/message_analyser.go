package analyser

import (
	"strings"
	"unicode"
)

// Analysis holds the extracted features of an incoming message.
// These fields drive cipher-style selection and prompt construction.
type Analysis struct {
	Tone     string // formal | informal | neutral
	Urgency  string // high | medium | low
	Length   string // short | medium | long
	Language string // en | ru | unknown
}

// Analyse extracts tone, urgency, length and language from text.
// All logic is heuristic — sufficient to steer the LLM prompt style.
func Analyse(text string) Analysis {
	return Analysis{
		Tone:     detectTone(text),
		Urgency:  detectUrgency(text),
		Length:   detectLength(text),
		Language: detectLanguage(text),
	}
}

func detectTone(text string) string {
	lower := strings.ToLower(text)
	formalMarkers := []string{"please", "kindly", "regarding", "sincerely", "пожалуйста", "уважаемый", "согласно"}
	informalMarkers := []string{"hey", "lol", "omg", "gonna", "wanna", "привет", "давай", "чё", "ок"}

	for _, m := range formalMarkers {
		if strings.Contains(lower, m) {
			return "formal"
		}
	}
	for _, m := range informalMarkers {
		if strings.Contains(lower, m) {
			return "informal"
		}
	}
	return "neutral"
}

func detectUrgency(text string) string {
	upper := strings.ToUpper(text)
	urgentMarkers := []string{"URGENT", "ASAP", "NOW", "IMMEDIATELY", "СРОЧНО", "НЕМЕДЛЕННО"}
	mediumMarkers := []string{"soon", "today", "сегодня", "скоро"}

	for _, m := range urgentMarkers {
		if strings.Contains(upper, m) {
			return "high"
		}
	}
	// Exclamation marks also suggest urgency
	if strings.Count(text, "!") >= 2 {
		return "high"
	}
	for _, m := range mediumMarkers {
		if strings.Contains(strings.ToLower(text), m) {
			return "medium"
		}
	}
	return "low"
}

func detectLength(text string) string {
	words := len(strings.Fields(text))
	switch {
	case words <= 10:
		return "short"
	case words <= 40:
		return "medium"
	default:
		return "long"
	}
}

// detectLanguage uses Cyrillic character presence as the primary signal.
func detectLanguage(text string) string {
	var cyrillic, latin int
	for _, r := range text {
		switch {
		case unicode.Is(unicode.Cyrillic, r):
			cyrillic++
		case unicode.IsLetter(r) && r < 0x250:
			latin++
		}
	}
	switch {
	case cyrillic > latin:
		return "ru"
	case latin > 0:
		return "en"
	default:
		return "unknown"
	}
}
