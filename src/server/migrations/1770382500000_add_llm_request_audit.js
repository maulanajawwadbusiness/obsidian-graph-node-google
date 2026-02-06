exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('llm_request_audit', {
    request_id: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    user_id: { type: 'bigint', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    endpoint_kind: { type: 'text', notNull: true },
    selected_provider: { type: 'text', notNull: true },
    actual_provider_used: { type: 'text', notNull: true },
    logical_model: { type: 'text', notNull: true },
    provider_model_id: { type: 'text', notNull: true },
    usage_source: { type: 'text', notNull: true },
    input_tokens: { type: 'bigint', notNull: true },
    output_tokens: { type: 'bigint', notNull: true },
    total_tokens: { type: 'bigint', notNull: true },
    tokenizer_encoding_used: { type: 'text' },
    tokenizer_fallback_reason: { type: 'text' },
    provider_usage_present: { type: 'boolean', notNull: true, default: false },
    fx_usd_idr: { type: 'numeric' },
    price_usd_per_mtoken: { type: 'numeric' },
    markup_multiplier: { type: 'numeric', notNull: true, default: 1.5 },
    cost_idr: { type: 'bigint', notNull: true, default: 0 },
    balance_before_idr: { type: 'bigint' },
    balance_after_idr: { type: 'bigint' },
    charge_status: { type: 'text', notNull: true, default: 'unknown' },
    charge_error_code: { type: 'text' },
    freepool_applied: { type: 'boolean', notNull: true, default: false },
    freepool_decrement_tokens: { type: 'bigint', notNull: true, default: 0 },
    freepool_reason: { type: 'text' },
    http_status: { type: 'integer' },
    termination_reason: { type: 'text' }
  });

  pgm.addConstraint('llm_request_audit', 'llm_request_audit_pk', {
    primaryKey: ['request_id']
  });

  pgm.createIndex('llm_request_audit', ['user_id', { name: 'created_at', sort: 'desc' }]);
  pgm.createIndex('llm_request_audit', [{ name: 'created_at', sort: 'desc' }]);
  pgm.createIndex('llm_request_audit', ['endpoint_kind', { name: 'created_at', sort: 'desc' }]);
};

exports.down = (pgm) => {
  pgm.dropTable('llm_request_audit');
};
