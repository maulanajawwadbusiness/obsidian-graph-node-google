exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("feedback_messages", {
    id: {
      type: "bigserial",
      primaryKey: true,
      notNull: true,
    },
    user_id: {
      type: "bigint",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    category: {
      type: "text",
      notNull: true,
      default: "",
    },
    message: {
      type: "text",
      notNull: true,
    },
    context_json: {
      type: "jsonb",
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
    },
    status: {
      type: "text",
      notNull: true,
      default: "new",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.addConstraint("feedback_messages", "feedback_messages_status_check", {
    check: "status in ('new','triaged','done')",
  });

  pgm.createIndex("feedback_messages", [{ name: "created_at", sort: "desc" }], {
    name: "feedback_messages_created_idx",
  });

  pgm.createIndex(
    "feedback_messages",
    ["status", { name: "created_at", sort: "desc" }],
    {
      name: "feedback_messages_status_created_idx",
    }
  );

  pgm.createIndex(
    "feedback_messages",
    ["user_id", { name: "created_at", sort: "desc" }],
    {
      name: "feedback_messages_user_created_idx",
    }
  );
};

exports.down = (pgm) => {
  pgm.dropTable("feedback_messages");
};
