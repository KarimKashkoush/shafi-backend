const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function buildDateFromDateOnly(value) {
      if (!DATE_ONLY_REGEX.test(value)) return null;
      const [year, month, day] = value.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return Number.isNaN(date.getTime()) ? null : date;
}

function toUtcIso(value, { dateOnly = false } = {}) {
      if (!value) return null;

      let date;
      if (value instanceof Date) {
            date = value;
      } else if (dateOnly && typeof value === "string") {
            date = buildDateFromDateOnly(value);
      } else {
            date = new Date(value);
      }

      if (!date || Number.isNaN(date.getTime())) {
            return null;
      }

      return date.toISOString();
}

module.exports = {
      toUtcIso,
};

