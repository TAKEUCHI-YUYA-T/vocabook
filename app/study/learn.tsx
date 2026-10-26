import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { FlagTag } from "@/components/FlagTag";
import { HeaderTextButton } from "@/components/ScreenHeader";
import { QuizFrame } from "@/components/QuizFrame";
import { ExampleList } from "@/components/ExampleList";
import { ExamplesByPartOfSpeech, MeaningByPartOfSpeech, OtherPartsPanel } from "@/components/SameTermSections";
import { SpeakButton } from "@/components/SpeakButton";
import { colors } from "@/components/theme";
import { useRepository } from "@/db/AppDatabase";
import { localDay } from "@/db/day";
import { nextQuestion, progress, startQuiz, type QuizState } from "@/db/quiz";
import { groupByTerm, oneCardPerTerm, otherPartsOfSpeech, sameTermCards } from "@/db/sameTerm";
import { decodeDirection, decodeFlags } from "@/db/studyRange";
import { partOfSpeechLabel, PARTS_OF_SPEECH, type Card, type CardFlag, type PartOfSpeech } from "@/db/types";
import { useGoBack } from "@/hooks/useGoBack";
import { speakEnglish, stopSpeaking } from "@/lib/speech";
import { spellingProblemsOnDevice } from "@/db/posDictionary";

/**
 * 学習画面
 * 条件（単語帳・品詞・フラグ・出題の向き）に合う単語を DB から読み、ランダムな順に出題する
 * - 答えを出す操作は、下の「答えを見る」ボタンだけ（見たら、その単語を「今日見た」として記録する）
 * - 答えを見たあとは、「要復習」「覚えた」「次へ」の3つの同じ大きさのボタンで進む（「次へ」はフラグを変えない）
 * - 向きは、英語→日本語、日本語→英語、聞き取り（音声を聞いて意味を思い出す）
 * - 同じ綴りで、品詞が違う単語（別のカード）がある場合
 *   英→日・日→英: 答えの面の一番下に、「ほかの品詞」として、その意味を並べる
 *   聞き取り: 同じ綴りは1回だけ出題し、答えの面に、全品詞の意味と例文を、品詞ごとに並べる。フラグと記録は、同じ綴りの全カードに付ける
 */
export default function LearnScreen() {
  const router = useRouter();
  const repository = useRepository();
  const goBack = useGoBack("/study");
  const params = useLocalSearchParams<{ decks?: string; parts?: string; flags?: string; dir?: string }>();
  const { decks, parts, flags } = params;
  const direction = decodeDirection(params.dir);

  const [quiz, setQuiz] = useState<QuizState<Card> | null>(null);
  /** 同じ綴りの単語が2つ以上ある単語の、綴りごとのまとまり（絞り込みに関係なく、単語帳の全体から） */
  const [groups, setGroups] = useState<Map<string, Card[]>>(() => new Map());
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 条件が変わったときに、問題を読み直す
   * 編集画面から戻ったときは、出題の途中経過を保ったまま、最新の内容に差し替える
   */
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const deckIds = (decks ?? "").split(",").filter(Boolean);
      const partsOfSpeech = (parts ?? "")
        .split(",")
        .filter((p): p is PartOfSpeech => PARTS_OF_SPEECH.some((part) => part.key === p));
      const flagFilter: CardFlag[] = decodeFlags(flags);

      Promise.all([
        repository.listStudyCards({ deckIds, partsOfSpeech, flags: flagFilter, requireMeaning: direction === "ja-en" }),
        repository.listCardsSharingTerm(deckIds),
      ])
        .then(([found, sharing]) => {
          if (!active) return;
          // 聞き取りは、同じ綴りを1回だけ出題する（同じ音を、品詞の数だけ聞かせない）
          const cards = direction === "listen" ? oneCardPerTerm(found) : found;
          setGroups(groupByTerm(sharing));
          setError(null);
          setQuiz((prev) => {
            if (!prev) return startQuiz(cards);
            // すでに出題中なら、順番を保ったまま、内容だけ最新にする（削除された単語・条件に合わなくなった単語は除く）
            const latest = new Map(cards.map((card) => [card.id, card]));
            const order = prev.order.filter((card) => latest.has(card.id)).map((card) => latest.get(card.id) as Card);
            return { ...prev, order, index: Math.min(prev.index, Math.max(order.length - 1, 0)) };
          });
        })
        .catch(() => active && setError("単語を読み込めませんでした"));
      return () => {
        active = false;
      };
    }, [repository, decks, parts, flags, direction])
  );

  const current = quiz && quiz.order.length > 0 ? quiz.order[quiz.index] : null;
  /** 同じ綴りの単語すべて（いま出している単語を含む。品詞の並び） */
  const sameTerm = current ? sameTermCards(current, groups) : [];
  /** フラグと「今日見た」の記録を付ける単語。聞き取りは、同じ綴りの全カード（答えの面に、全品詞を出すため） */
  const targetIds = current ? (direction === "listen" ? sameTerm.map((card) => card.id) : [current.id]) : [];
  const otherParts = current ? otherPartsOfSpeech(current, groups) : [];
  // 辞書にない単語（綴りミスの疑い）は、読み上げボタンに目印を付ける
  const termUnknown = !!current && spellingProblemsOnDevice(current.term).length > 0;

  // 聞き取りは、単語が変わるたびに、自動で読み上げる。画面を離れたら、読み上げを止める
  useEffect(() => {
    if (direction === "listen" && current) speakEnglish(current.term);
  }, [direction, current?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopSpeaking(), []);

  const next = () => {
    setQuiz((prev) => (prev ? nextQuestion(prev) : prev));
    setIsAnswerVisible(false);
  };

  /** 答えを見る。見た単語として、今日の記録に残す（記録に失敗しても、学習は続けられる） */
  const reveal = () => {
    setIsAnswerVisible(true);
    for (const id of targetIds) repository.recordStudied(id, localDay()).catch((e) => console.warn("[study] 学習の記録に失敗:", e));
  };

  /** フラグを付けて、次の問題へ進む */
  const mark = async (flag: CardFlag) => {
    if (!current) return;
    try {
      for (const id of targetIds) await repository.setFlag(id, flag);
      setQuiz((prev) => (prev ? { ...prev, order: prev.order.map((card) => (targetIds.includes(card.id) ? { ...card, flag } : card)) } : prev));
    } catch (e) {
      console.warn("[study] フラグを付けられませんでした:", e);
    }
    next();
  };

  const message = error ?? (!quiz ? "読み込み中..." : current ? null : "この条件に合う単語がありません");

  const answerFooter = current && (
    // 左から 要復習・次へ・覚えた（正反対の2つを離して、押し間違いを防ぐ）。3つとも同じ形と重さ。今のフラグのボタンだけ、塗りつぶす
    <View style={styles.flagRow}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ selected: current.flag === "review" }}
        style={[styles.flagButton, current.flag === "review" ? styles.reviewActive : styles.reviewButton]}
        onPress={() => mark("review")}
      >
        <Feather name="rotate-ccw" size={18} color={current.flag === "review" ? colors.surface : colors.warning} />
        <Text style={[styles.flagText, { color: current.flag === "review" ? colors.surface : colors.warning }]}>要復習</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" style={[styles.flagButton, styles.nextFlagButton]} onPress={next}>
        <Text style={[styles.flagText, { color: colors.text }]}>次へ</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ selected: current.flag === "learned" }}
        style={[styles.flagButton, current.flag === "learned" ? styles.learnedActive : styles.learnedButton]}
        onPress={() => mark("learned")}
      >
        <Feather name="check" size={18} color={current.flag === "learned" ? colors.onPrimary : colors.onPrimarySoft} />
        <Text style={[styles.flagText, { color: current.flag === "learned" ? colors.onPrimary : colors.onPrimarySoft }]}>覚えた</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <QuizFrame
      title="学習"
      onBack={goBack}
      backLabel="学習の範囲に戻る"
      backText="範囲"
      progress={quiz && current ? progress(quiz) : null}
      headerExtra={
        current ? (
          <HeaderTextButton label="編集" onPress={() => router.push({ pathname: "/cards/[id]", params: { id: current.id } })} />
        ) : undefined
      }
      action={current && !isAnswerVisible ? { kind: "reveal", onPress: reveal } : null}
      footer={current && isAnswerVisible ? answerFooter : undefined}
      message={message}
    >
      {!!current && (
        <>
          <View style={styles.tags}>
            {!!current.partOfSpeech && direction !== "listen" && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{partOfSpeechLabel(current.partOfSpeech)}</Text>
              </View>
            )}
            <FlagTag flag={current.flag} />
          </View>

          {/* 問題 */}
          {direction === "en-ja" && (
            <>
              <View style={styles.termRow}>
                <Text style={styles.term}>{current.term}</Text>
                <SpeakButton text={current.term} label="単語を読み上げる" warn={termUnknown} />
              </View>
              {current.examples.length > 0 && <ExampleList examples={current.examples} />}
            </>
          )}
          {direction === "ja-en" && (
            <>
              <Text style={styles.questionMeaning}>{current.meaning}</Text>
              {current.examples.some((e) => e.translation) && (
                <>
                  <Text style={styles.hintText}>例文の訳</Text>
                  <ExampleList examples={current.examples} showText={false} showTranslation />
                </>
              )}
            </>
          )}
          {direction === "listen" && (
            <View style={isAnswerVisible ? styles.listenCompact : styles.listen}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="もう一度聞く"
                style={isAnswerVisible ? styles.listenButtonSmall : styles.listenButton}
                onPress={() => speakEnglish(current.term)}
              >
                <Feather name="volume-2" size={isAnswerVisible ? 26 : 44} color={colors.onPrimary} />
              </TouchableOpacity>
              <Text style={styles.listenText}>聞こえた単語の意味は？</Text>
              {!isAnswerVisible && <Text style={styles.hintText}>押すと、もう一度聞けます</Text>}
            </View>
          )}

          {/* 答え */}
          {isAnswerVisible && (
            <View style={styles.answer}>
              {direction !== "en-ja" && (
                <View style={styles.termRow}>
                  <Text style={styles.term}>{current.term}</Text>
                  <SpeakButton text={current.term} label="単語を読み上げる" warn={termUnknown} />
                </View>
              )}
              {direction === "listen" ? (
                <>
                  {sameTerm.some((card) => card.meaning.trim() !== "") && (
                    <>
                      <Text style={styles.label}>意味</Text>
                      <MeaningByPartOfSpeech cards={sameTerm} />
                    </>
                  )}
                  {sameTerm.some((card) => card.examples.some((e) => e.text)) && (
                    <>
                      <Text style={[styles.label, styles.labelGap]}>例文</Text>
                      <ExamplesByPartOfSpeech cards={sameTerm} />
                    </>
                  )}
                </>
              ) : (
                <>
                  {direction === "en-ja" && !!current.meaning && (
                    <>
                      <Text style={styles.label}>意味</Text>
                      <Text style={styles.meaning}>{current.meaning}</Text>
                    </>
                  )}
                  {direction === "ja-en" && current.examples.some((e) => e.text) && (
                    <>
                      <Text style={[styles.label, styles.labelGap]}>例文</Text>
                      <ExampleList examples={current.examples} />
                    </>
                  )}
                  {direction === "en-ja" && current.examples.some((e) => e.translation) && (
                    <>
                      <Text style={[styles.label, styles.labelGap]}>例文の訳</Text>
                      <ExampleList examples={current.examples} showText={false} showTranslation />
                    </>
                  )}
                  {/* ほかの品詞は、答えの面の一番下（例文・例文の訳の下）。メモの前 */}
                  <OtherPartsPanel cards={otherParts} />
                </>
              )}
              {!!current.note && (
                <>
                  <Text style={[styles.label, styles.labelGap]}>メモ</Text>
                  <Text style={styles.translation}>{current.note}</Text>
                </>
              )}
            </View>
          )}
        </>
      )}
    </QuizFrame>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 24 },
  tag: { borderRadius: 999, paddingVertical: 2, paddingHorizontal: 10, backgroundColor: colors.panel },
  tagText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  termRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  term: { flexShrink: 1, fontSize: 40, fontWeight: "bold", lineHeight: 48, letterSpacing: -0.5, color: colors.text },
  questionMeaning: { fontSize: 26, fontWeight: "bold", lineHeight: 38, color: colors.text },
  hintText: { fontSize: 14, lineHeight: 22, color: colors.secondary },
  listen: { alignItems: "center", gap: 12, paddingVertical: 24 },
  listenCompact: { flexDirection: "row", alignItems: "center", gap: 14, paddingBottom: 4 },
  listenButton: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  listenButtonSmall: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  listenText: { fontSize: 15, fontWeight: "600", color: colors.secondary },
  answer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.inputBorder, paddingTop: 16, marginTop: 4, gap: 12 },
  label: { fontSize: 13, fontWeight: "600", color: colors.secondary },
  labelGap: { marginTop: 4 },
  meaning: { fontSize: 22, fontWeight: "600", lineHeight: 30, color: colors.text },
  translation: { fontSize: 15, lineHeight: 24, color: colors.textMuted },

  flagRow: { flexDirection: "row", gap: 8 },
  flagButton: { flex: 1, minHeight: 56, borderRadius: 28, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" },
  flagText: { fontSize: 17, fontWeight: "600" },
  reviewButton: { backgroundColor: colors.warningSoft },
  reviewActive: { backgroundColor: colors.warning },
  nextFlagButton: { backgroundColor: colors.fill },
  learnedButton: { backgroundColor: colors.primarySoft },
  learnedActive: { backgroundColor: colors.primary },
});
