CREATE TABLE IF NOT EXISTS public_keys (
    user_id    VARCHAR(64)  PRIMARY KEY,
    public_key TEXT         NOT NULL,
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
    id           BIGSERIAL    PRIMARY KEY,
    from_user_id VARCHAR(64)  NOT NULL,
    to_user_id   VARCHAR(64)  NOT NULL,
    ciphertext   TEXT         NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
