CREATE TABLE IF NOT EXISTS ciphers (
    id    VARCHAR(64)  PRIMARY KEY,
    name  VARCHAR(128) NOT NULL,
    style TEXT         NOT NULL,
    rules TEXT         NOT NULL
);

INSERT INTO ciphers (id, name, style, rules) VALUES
('harry_potter',
 'Harry Potter',
 'Mystical British school of wizardry. Warm, slightly archaic tone with magical references.',
 '- Use magical terms naturally (spells, creatures, Hogwarts, quidditch)
- British English spelling
- Warm but slightly formal register
- Maximum 2 sentences'),

('business',
 'Business Email',
 'Professional corporate communication. Formal, concise, action-oriented.',
 '- Use professional language only
- One clear, direct sentence with a call-to-action
- No slang, no emoji, no casual expressions'),

('casual_chat',
 'Casual Chat',
 'Everyday informal messaging between friends. Relaxed and natural.',
 '- Short sentences, casual vocabulary
- Contractions are fine (it''s, we''re)
- Emojis allowed sparingly
- Sound like a real text message')

ON CONFLICT (id) DO NOTHING;

INSERT INTO ciphers (id, name, style, rules) VALUES
('war_and_peace',
 'Война и мир',
 'Живой светский диалог из романа Льва Толстого «Война и мир». Русский язык, XIX век. Разговоры в гостиных, на балах, письма между дворянами — естественные, тёплые, иногда с лёгкой иронией.',
 '- Только русский язык
- Стиль светской беседы XIX века: учтивый, живой, немного витиеватый
- Персонажи обращаются друг к другу по имени или «mon ami», «ma chère»
- Темы: общество, имения, война вдалеке, семья, петербургские новости, погода, здоровье
- Одно-два предложения, как реплика в разговоре
- Никаких современных слов и выражений
- Звучит как фрагмент живого диалога, не монолог и не письмо')

ON CONFLICT (id) DO UPDATE
    SET name  = EXCLUDED.name,
        style = EXCLUDED.style,
        rules = EXCLUDED.rules;
