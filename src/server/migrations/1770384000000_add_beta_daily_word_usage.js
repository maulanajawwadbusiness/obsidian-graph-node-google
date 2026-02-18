exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("beta_daily_word_usage", {
    date_key: {
      type: "text",
      notNull: true
    },
    user_id: {
      type: "bigint",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE"
    },
    used_words: {
      type: "bigint",
      notNull: true,
      default: 0
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()")
    }
  });

  pgm.addConstraint(
    "beta_daily_word_usage",
    "beta_daily_word_usage_pk",
    {
      primaryKey: ["date_key", "user_id"]
    }
  );
};

exports.down = (pgm) => {
  pgm.dropTable("beta_daily_word_usage");
};
