package handler

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	"messenger/api-gateway/internal/repository"
	"messenger/api-gateway/internal/service"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// inboundMsg covers all message types from the client.
//
// "auth"         — {"type":"auth","priv_key":"<base64>"}
// "send_message" — {"type":"send_message","to":"<user_id>","to_telegram":"@username","text":"...","cipher_id":"..."}
type inboundMsg struct {
	Type       string `json:"type"`
	PrivKey    string `json:"priv_key,omitempty"`
	To         string `json:"to,omitempty"`          // internal user_id for key lookup
	ToTelegram string `json:"to_telegram,omitempty"` // Telegram @username or phone
	Text       string `json:"text,omitempty"`
	CipherID   string `json:"cipher_id,omitempty"`
}

type outboundMsg struct {
	Type       string `json:"type"`
	Stego      string `json:"stego,omitempty"`       // stego message to send via Telethon
	ToTelegram string `json:"to_telegram,omitempty"` // echo back so client knows where to send
	Error      string `json:"error,omitempty"`
}

type WSHandler struct {
	msgSvc *service.MessageService
	rdb    *repository.RedisClient
}

func NewWSHandler(msgSvc *service.MessageService, rdb *repository.RedisClient) *WSHandler {
	return &WSHandler{msgSvc: msgSvc, rdb: rdb}
}

// Handle upgrades the HTTP connection to WebSocket and drives the message loop.
//
// Connection protocol:
//  1. Client connects: GET /ws?user_id=<id>
//  2. Client sends {"type":"auth","priv_key":"<base64>"} — stores key in Redis session
//  3. Client sends {"type":"send_message",...} — triggers the full send flow
func (h *WSHandler) Handle(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "user_id required", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws upgrade: %v", err)
		return
	}
	defer conn.Close()

	authenticated := false

	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			break
		}

		var msg inboundMsg
		if err := json.Unmarshal(raw, &msg); err != nil {
			send(conn, outboundMsg{Type: "error", Error: "invalid json"})
			continue
		}

		switch msg.Type {
		case "auth":
			if msg.PrivKey == "" {
				send(conn, outboundMsg{Type: "error", Error: "priv_key required"})
				continue
			}
			if err := h.rdb.SetSession(r.Context(), userID, msg.PrivKey); err != nil {
				send(conn, outboundMsg{Type: "error", Error: "session error"})
				continue
			}
			authenticated = true
			send(conn, outboundMsg{Type: "auth_ok"})

		case "send_message":
			if !authenticated {
				send(conn, outboundMsg{Type: "error", Error: "not authenticated"})
				continue
			}
			if msg.To == "" || msg.Text == "" {
				send(conn, outboundMsg{Type: "error", Error: "to and text required"})
				continue
			}
			stego, err := h.msgSvc.Build(r.Context(), userID, msg.To, msg.Text, msg.CipherID)
			if err != nil {
				log.Printf("build %s→%s: %v", userID, msg.To, err)
				send(conn, outboundMsg{Type: "error", Error: err.Error()})
				continue
			}
			send(conn, outboundMsg{Type: "send", Stego: stego, ToTelegram: msg.ToTelegram})

		default:
			send(conn, outboundMsg{Type: "error", Error: "unknown type: " + msg.Type})
		}
	}
}

func send(conn *websocket.Conn, msg outboundMsg) {
	b, _ := json.Marshal(msg)
	conn.WriteMessage(websocket.TextMessage, b) //nolint:errcheck
}
