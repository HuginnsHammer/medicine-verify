// Mock OCR provider: no image analysis is performed.
// Never report a successful match from a stub.

const extractPackFields = async () => ({
  batchNo: '',
  expiry: '',
  manufacturer: '',
  confidence: 0
});

const comparePack = async () => ({
  match: 'unreadable',
  differences: []
});

module.exports = {
  extractPackFields,
  comparePack
};
