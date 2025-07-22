function previewBundle(transactions) {
  return transactions
    .map((tx, idx) => `#${idx + 1}: ${tx.instructions.length} instructions`)
    .join("\n");
}

module.exports = { previewBundle };
