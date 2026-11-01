(function (global) {
  const DEFAULT_EXPLORERS = [
    { id: 'a1', name: 'أحمد', active: true, score: 0, answerAttempts: 0, correctAnswers: 0, skipped: 0 },
    { id: 'a2', name: 'محمد', active: true, score: 0, answerAttempts: 0, correctAnswers: 0, skipped: 0 },
    { id: 'a3', name: 'علي', active: true, score: 0, answerAttempts: 0, correctAnswers: 0, skipped: 0 },
    { id: 'a4', name: 'محمود', active: true, score: 0, answerAttempts: 0, correctAnswers: 0, skipped: 0 },
    { id: 'a5', name: 'يوسف', active: true, score: 0, answerAttempts: 0, correctAnswers: 0, skipped: 0 },
    { id: 'a6', name: 'عمر', active: true, score: 0, answerAttempts: 0, correctAnswers: 0, skipped: 0 }
  ];

  const DEFAULT_QUESTIONS = [
    { id: 'q1', station: 'الموقع الجغرافي', subject: 'قارات العالم', type: 'اختيار من متعدد', difficulty: 'فضي', points: 10, correct: 'أمريكا الجنوبية' },
    { id: 'q2', station: 'الموقع الجغرافي', subject: 'قارات العالم', type: 'صح/خطأ', difficulty: 'برونزي', points: 8, correct: 'صح' },
    { id: 'q3', station: 'الرحالة', subject: 'اكتشافات', type: 'مباشر', difficulty: 'فضي', points: 12, correct: 'كريستوفر كولومب' },
    { id: 'q4', station: 'الموقع الجغرافي', subject: 'الأنهار', type: 'اختيار من متعدد', difficulty: 'ذهبي', points: 15, correct: 'الأمازون' },
    { id: 'q5', station: 'السفر', subject: 'المعالم', type: 'مقالية', difficulty: 'ذهبي', points: 18, correct: 'أهرامات مصر' },
    { id: 'q6', station: 'الرحالة', subject: 'المغامرات', type: 'اختيار من متعدد', difficulty: 'فضي', points: 10, correct: 'البرتغال' },
    { id: 'q7', station: 'السفر', subject: 'المنابع', type: 'صح/خطأ', difficulty: 'برونزي', points: 8, correct: 'خطأ' },
    { id: 'q8', station: 'الموقع الجغرافي', subject: 'الجبال', type: 'مباشر', difficulty: 'فضي', points: 12, correct: 'الأنديز' },
    { id: 'q9', station: 'الموقع الجغرافي', subject: 'المحيطات', type: 'اختيار من متعدد', difficulty: 'ذهبي', points: 15, correct: 'المحيط الهادئ' },
    { id: 'q10', station: 'الرحالة', subject: 'الرحلات الطويلة', type: 'مقالية', difficulty: 'ذهبي', points: 18, correct: 'رحلة الاستكشاف' }
  ];

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function makeId(prefix) {
    return prefix + '-' + Math.random().toString(36).slice(2, 10);
  }

  class AuditLog {
    constructor() {
      this.events = [];
    }

    add(event) {
      const record = {
        id: makeId('audit'),
        timestamp: new Date().toISOString(),
        type: event.type || 'unknown',
        actor: event.actor || 'system',
        detail: event.detail || {},
        reason: event.reason || ''
      };
      this.events.push(record);
      return record;
    }

    snapshot() {
      return clone(this.events);
    }
  }

  class TeacherAuth {
    constructor() {
      this.passwordHash = this.hash('ExplorerJourney2025');
      this.authenticated = false;
    }

    hash(value) {
      let hash = 0;
      for (let i = 0; i < value.length; i++) {
        hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
      }
      return hash.toString(16);
    }

    verify(value) {
      const incoming = this.hash(String(value || ''));
      const ok = incoming === this.passwordHash;
      this.authenticated = ok;
      return ok;
    }

    ensureTeacherAccess() {
      if (!this.authenticated) {
        throw new Error('Teacher access is required');
      }
      return true;
    }
  }

  class FairTurnEngine {
    constructor(explorers) {
      this.explorers = explorers.map((e, index) => ({ ...e, order: index }));
      this.currentIndex = 0;
      this.turnAttemptCounters = new Map(this.explorers.map((e) => [e.name, 0]));
      this.audit = new AuditLog();
    }

    reset(explorers) {
      this.explorers = explorers.map((e, index) => ({ ...e, order: index }));
      this.currentIndex = 0;
      this.turnAttemptCounters = new Map(this.explorers.map((e) => [e.name, 0]));
    }

    getActiveExplorers() {
      return this.explorers.filter((e) => e.active !== false);
    }

    getCurrentExplorer() {
      const active = this.getActiveExplorers();
      return active[this.currentIndex % active.length] || active[0];
    }

    getNextTurnIndex(startIndex = this.currentIndex) {
      const active = this.getActiveExplorers();
      if (!active.length) return 0;
      let index = startIndex;
      let tries = 0;
      while (tries < active.length) {
        index = (index + 1) % active.length;
        tries += 1;
      }
      return index;
    }

    advanceTurn() {
      const active = this.getActiveExplorers();
      if (!active.length) return null;
      const prev = this.currentIndex;
      this.currentIndex = (this.currentIndex + 1) % active.length;
      const next = this.getCurrentExplorer();
      this.audit.add({
        type: 'turn_advanced',
        actor: 'system',
        detail: { prev: active[prev]?.name || '', next: next.name },
        reason: 'automatic_cycle'
      });
      return next;
    }

    manualResponderChange(selectedName, currentName) {
      const current = this.explorers.find((e) => e.name === currentName);
      const selected = this.explorers.find((e) => e.name === selectedName);
      if (!current || !selected) return { allowed: false, reason: 'invalid_player' };
      if (selected.name === current.name) {
        return { allowed: true, reason: 'same_player' };
      }

      const activeNames = this.getActiveExplorers().map((e) => e.name);
      if (!activeNames.includes(selected.name)) {
        return { allowed: false, reason: 'inactive_player' };
      }

      const currentAttempts = this.turnAttemptCounters.get(current.name) || 0;
      const selectedAttempts = this.turnAttemptCounters.get(selected.name) || 0;

      if (selectedAttempts > currentAttempts) {
        return { allowed: false, reason: 'manual_change_would_add_extra_turn' };
      }

      const nextIndex = this.explorers.findIndex((e) => e.name === selected.name);
      this.currentIndex = nextIndex;
      this.turnAttemptCounters.set(selected.name, (this.turnAttemptCounters.get(selected.name) || 0) + 1);
      this.audit.add({
        type: 'manual_responder_change',
        actor: 'teacher',
        detail: { from: current.name, to: selected.name },
        reason: 'manual_override_respects_turn_balance'
      });
      return { allowed: true, nextExplorer: selected, reason: 'manual_override' };
    }

    addAttempt(name) {
      const key = this.explorers.find((e) => e.name === name);
      if (!key) return null;
      const after = (this.turnAttemptCounters.get(name) || 0) + 1;
      this.turnAttemptCounters.set(name, after);
      return after;
    }
  }

  class UnifiedQuestionLifecycle {
    constructor(gameState) {
      this.state = gameState;
      this.locked = false;
    }

    ensureUnlocked() {
      if (this.locked) return false;
      return true;
    }

    processOutcome({ answerState, responderName, question, points, reason, manualOverride = false }) {
      if (!this.ensureUnlocked()) {
        return { ok: false, reason: 'question_already_processed' };
      }
      this.locked = true;
      const responder = this.state.explorers.find((e) => e.name === responderName);
      if (!responder) {
        return { ok: false, reason: 'responder_not_found' };
      }
      const scoreDelta = answerState === 'correct' ? points : answerState === 'wrong' ? -Math.max(0, points) : 0;
      responder.score = Number((responder.score || 0) + scoreDelta);
      responder.answerAttempts = Number((responder.answerAttempts || 0) + 1);
      if (answerState === 'correct') responder.correctAnswers = Number((responder.correctAnswers || 0) + 1);
      if (answerState === 'skipped') responder.skipped = Number((responder.skipped || 0) + 1);

      this.state.latestQuestionLog = {
        questionId: question.id,
        responder: responder.name,
        outcome: answerState,
        reason,
        points: scoreDelta,
        scoreAfter: responder.score,
        manualOverride
      };

      this.state.audit.add({
        type: 'question_processed',
        actor: responder.name,
        detail: this.state.latestQuestionLog,
        reason: reason || 'question_lifecycle'
      });

      return { ok: true, scoreDelta, responder };
    }
  }

  class FairQuestionDistributionEngine {
    static buildPlan({ explorers, questionBank, requiredQuestions = 12, stationFocus = null }) {
      const groups = {};
      const byType = {};
      const byDifficulty = {};
      const byPoints = {};

      for (const explorer of explorers) {
        groups[explorer.name] = {
          total: 0,
          byType: {},
          byDifficulty: {},
          byPoints: {},
          stations: {},
          subjects: {}
        };
      }

      const questionPool = questionBank.filter((q) => !stationFocus || q.station === stationFocus);
      const distribution = [];
      const byTypeNames = ['اختيار من متعدد', 'صح/خطأ', 'مباشر', 'مقالية'];
      const diffNames = ['برونزي', 'فضي', 'ذهبي'];

      for (let i = 0; i < requiredQuestions; i++) {
        const question = questionPool[i % questionPool.length];
        distribution.push({
          ...clone(question),
          id: question.id + '-' + i,
          assignedTo: explorers[i % explorers.length].name
        });
        const assigned = explorers[i % explorers.length].name;
        groups[assigned].total += 1;
        groups[assigned].byType[question.type] = (groups[assigned].byType[question.type] || 0) + 1;
        groups[assigned].byDifficulty[question.difficulty] = (groups[assigned].byDifficulty[question.difficulty] || 0) + 1;
        groups[assigned].byPoints[question.points] = (groups[assigned].byPoints[question.points] || 0) + 1;
        groups[assigned].stations[question.station] = (groups[assigned].stations[question.station] || 0) + 1;
        groups[assigned].subjects[question.subject] = (groups[assigned].subjects[question.subject] || 0) + 1;

        byType[question.type] = (byType[question.type] || 0) + 1;
        byDifficulty[question.difficulty] = (byDifficulty[question.difficulty] || 0) + 1;
        byPoints[question.points] = (byPoints[question.points] || 0) + 1;
      }

      const fairness = Object.keys(groups).every((name) => groups[name].total === Math.ceil(requiredQuestions / explorers.length));
      return { fairness, groups, distribution, byType, byDifficulty, byPoints };
    }

    static validate({ explorers, questionBank, requiredQuestions, stationFocus = null }) {
      const plan = this.buildPlan({ explorers, questionBank, requiredQuestions, stationFocus });
      const totalPool = questionBank.filter((q) => !stationFocus || q.station === stationFocus).length;
      const requiredPerType = Math.ceil(requiredQuestions / explorers.length);

      if (totalPool < requiredQuestions) {
        return {
          valid: false,
          reason: 'not_enough_questions',
          detail: { requiredQuestions, availableQuestions: totalPool, missing: requiredQuestions - totalPool }
        };
      }

      const valid = plan.fairness && totalPool >= requiredQuestions;
      return {
        valid,
        reason: valid ? 'fair_distribution_ready' : 'distribution_not_uniform',
        detail: plan
      };
    }
  }

  class TieBreakEngine {
    static compare(a, b, rules = { useStagePoints: true, useFilterPoints: false, useCorrectCount: true, useSkippedCount: true }) {
      const aScore = Number(a.score || 0);
      const bScore = Number(b.score || 0);
      if (aScore !== bScore) return aScore > bScore ? 1 : -1;

      if (rules.useCorrectCount) {
        if ((a.correctAnswers || 0) !== (b.correctAnswers || 0)) return (a.correctAnswers || 0) > (b.correctAnswers || 0) ? 1 : -1;
      }
      if (rules.useSkippedCount) {
        if ((a.skipped || 0) !== (b.skipped || 0)) return (a.skipped || 0) < (b.skipped || 0) ? 1 : -1;
      }
      return 0;
    }
  }

  const API = {
    DEFAULT_EXPLORERS,
    DEFAULT_QUESTIONS,
    AuditLog,
    TeacherAuth,
    FairTurnEngine,
    UnifiedQuestionLifecycle,
    FairQuestionDistributionEngine,
    TieBreakEngine,
    clone,
    makeId,
    createInitialState() {
      return {
        explorers: clone(DEFAULT_EXPLORERS),
        turnEngine: new FairTurnEngine(clone(DEFAULT_EXPLORERS)),
        questionBank: clone(DEFAULT_QUESTIONS),
        audit: new AuditLog(),
        currentQuestion: null,
        currentTurnName: 'أحمد',
        winnerThreshold: 150,
        currentRoundId: 'R-' + Date.now().toString().slice(-4),
        currentStage: 'map',
        finalPairs: null,
        teacherAuth: new TeacherAuth()
      };
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }

  global.ExplorerJourneyCore = API;
})(typeof window !== 'undefined' ? window : globalThis);

