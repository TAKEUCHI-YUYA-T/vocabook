import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { FlagTag } from "@/components/FlagTag";
import { HeaderIconButton } from "@/components/ScreenHeader";
import { QuizFrame } from "@/components/QuizFrame";
import { ExampleList } from "@/components/ExampleList";
import { SpeakButton } from "@/components/SpeakButton";
import { colors } from "@/components/theme";
import { useRepository } from "@/db/AppDatabase";
import { localDay } from "@/db/day";
import { nextQuestion, progress, startQuiz, type QuizState } from "@/db/quiz";
import { decodeDirection, decodeFlags } from "@/db/studyRange";
import { partOfSpeechLabel, PARTS_OF_SPEECH, type Card, type CardFlag, type PartOfSpeech } from "@/db/types";
import { useGoBack } from "@/hooks/useGoBack";
import { speakEnglish, stopSpeaking } from "@/lib/speech";
import { spellingProblemsOnDevice } from "@/db/posDictionary";

/**
 * 学習画面
 * 条件（単語帳・品詞・フラグ・出題の向き）に合う単語を DB から読み、ランダムな順に出題する
 * - 答えを出す操作は、下の「答えを見る」ボタンだけ（見たら、その単語を「今日見た」として記録する）
 * - 答えを見たあとは、「要復習」「覚えた」のフラグを付けて次へ進む。フラグを変えずに進むこともできる
 * - 向きは、英語→日本語、日本語→英語、聞き取り（音声を聞いて意味を思い出す）
 */
export default function LearnScreen() {
  const router = useRouter();
  const repository = useRepository();
  const goBack = useGoBack("/study");
  const params = useLocalSearchParams<{ decks?: string; parts?: string; flags?: string; dir?: string }>();
  const { decks, parts, flags } = params;
  const direction = decodeDirection(params.dir);

  const [quiz, setQuiz] = useState<QuizState<Card> | null>(null);
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

      repository
        .listStudyCards({ deckIds, partsOfSpeech, flags: flagFilter, requireMeaning: direction === "ja-en" })
        .then((cards) => {
          if (!active) return;
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
    if (current) repository.recordStudied(current.id, localDay()).catch((e) => console.warn("[study] 学習の記録に失敗:", e));
  };

  /** フラグを付けて、次の問題へ進む */
  const mark = async (flag: CardFlag) => {
    if (!current) return;
    try {
      await repository.setFlag(current.id, flag);
      setQuiz((prev) => (prev ? { ...prev, order: prev.order.map((card) => (card.id === current.id ? { ...card, flag } : card)) } : prev));
    } catch (e) {
      console.warn("[study] フラグを付けられませんでした:", e);
    }
    next();
  };

  const message = error ?? (!quiz ? "読み込み中..." : current ? null : "この条件に合う単語がありません");

  const answerFooter = current && (
    <View style={styles.footerBox}>
      <View style={styles.flagRow}>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: current.flag === "review" }} style={[styles.flagButton, styles.reviewButton]} onPress={() => mark("review")}>
          {current.flag === "review" && <Feather name="check" size={20} color={colors.surface} />}
          <Text style={styles.reviewText}>要復習</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: current.flag === "learned" }} style={[styles.flagButton, styles.learnedButton]} onPress={() => mark("learned")}>
          {current.flag === "learned" && <Feather name="check" size={20} color={colors.onPrimary} />}
          <Text style={styles.learnedText}>覚えた</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity accessibilityRole="button" style={styles.nextLink} onPress={next}>
        <Text style={styles.nextLinkText}>フラグを変えずに次へ</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <QuizFrame
      title="学習"
      onBack={goBack}
      backLabel="学習の範囲に戻る"
      progress={quiz && current ? progress(quiz) : null}
      headerExtra={
        current ? (
          <HeaderIconButton icon="edit-2" label="この単語を編集" onPress={() => router.push({ pathname: "/cards/[id]", params: { id: current.id } })} />
        ) : undefined
      }
      action={current && !isAnswerVisible ? { kind: "reveal", onPress: reveal } : null}
      footer={current && isAnswerVisible ? answerFooter : undefined}
      message={message}
    >
      {!!current && (
        <>
          <View style={styles.tags}>
            {!!current.partOfSpeech && (
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
            <View style={styles.listen}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="もう一度聞く" style={styles.listenButton} onPress={() => speakEnglish(current.term)}>
                <Feather name="volume-2" size={44} color={colors.onPrimary} />
              </TouchableOpacity>
              <Text style={styles.listenText}>聞こえた単語の意味は？</Text>
              <Text style={styles.hintText}>押すと、もう一度聞けます</Text>
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
              {direction !== "ja-en" && !!current.meaning && (
                <>
                  <Text style={styles.label}>意味</Text>
                  <Text style={styles.meaning}>{current.meaning}</Text>
                </>
              )}
              {direction !== "en-ja" && current.examples.some((e) => e.text) && (
                <>
                  <Text style={[styles.label, styles.labelGap]}>例文</Text>
                  <ExampleList examples={current.examples} showTranslation={direction !== "ja-en"} />
                </>
              )}
              {direction === "en-ja" && current.examples.some((e) => e.translation) && (
                <>
                  <Text style={[styles.label, styles.labelGap]}>例文の訳</Text>
                  <ExampleList examples={current.examples} showText={false} showTranslation />
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
  tags: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 22 },
  tag: { borderWidth: 1, borderColor: colors.secondary, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 8 },
  tagText: { fontSize: 13, fontWeight: "bold", color: colors.secondary },
  termRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  term: { flexShrink: 1, fontSize: 32, fontWeight: "bold", lineHeight: 40, color: colors.text },
  questionMeaning: { fontSize: 26, fontWeight: "bold", lineHeight: 38, color: colors.text },
  hintText: { fontSize: 14, lineHeight: 22, color: colors.secondary },
  listen: { alignItems: "center", gap: 12, paddingVertical: 24 },
  listenButton: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  listenText: { fontSize: 18, fontWeight: "bold", color: colors.text },
  answer: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16, marginTop: 4, gap: 12 },
  label: { fontSize: 13, fontWeight: "bold", color: colors.secondary },
  labelGap: { marginTop: 4 },
  meaning: { fontSize: 20, fontWeight: "bold", lineHeight: 30, color: colors.text },
  translation: { fontSize: 15, lineHeight: 26, color: colors.text },

  footerBox: { gap: 4 },
  flagRow: { flexDirection: "row", gap: 10 },
  flagButton: { flex: 1, minHeight: 60, borderRadius: 14, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" },
  reviewButton: { backgroundColor: colors.danger },
  learnedButton: { backgroundColor: colors.primary },
  reviewText: { fontSize: 19, fontWeight: "bold", color: colors.surface },
  learnedText: { fontSize: 19, fontWeight: "bold", color: colors.onPrimary },
  nextLink: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  nextLinkText: { fontSize: 15, color: colors.secondary, textDecorationLine: "underline" },
});
