import { Composition, Folder } from "remotion";
import { CaptionedVideo } from "./CaptionedVideo";
import {
  PhoneShowcase,
  type PhoneShowcaseProps,
} from "./FeatureVideos/PhoneShowcase";
import {
  FeatureHighlight,
  type FeatureHighlightProps,
} from "./FeatureVideos/FeatureHighlight";
import {
  BeforeAfter,
  type BeforeAfterProps,
} from "./FeatureVideos/BeforeAfter";
import {
  StatReveal,
  type StatRevealProps,
} from "./FeatureVideos/StatReveal";
import {
  ScreenRecordingShowcase,
  type ScreenRecordingShowcaseProps,
} from "./FeatureVideos/ScreenRecordingShowcase";
import {
  QuickDemo,
  type QuickDemoProps,
} from "./FeatureVideos/QuickDemo";
import {
  ProductDemo,
  type ProductDemoProps,
} from "./FeatureVideos/ProductDemo";

export type BrollEntry = {
  src: string;
  startSec: number;
  endSec: number;
};

export type CaptionedVideoProps = {
  src: string;
  broll: BrollEntry[];
  captionSrc: string;
  durationInFrames: number;
  hookText?: string;
};

const FEATURE_VIDEO_CONFIG = {
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: 450, // 15 seconds — matches TIMELINE.ctaEnd
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Existing talking head composition */}
      <Composition
        id="CaptionedVideo"
        component={CaptionedVideo}
        fps={30}
        width={1080}
        height={1920}
        calculateMetadata={async ({ props }) => {
          return {
            durationInFrames: props.durationInFrames || 1736,
          };
        }}
        defaultProps={{
          src: "raw/talking_head.mp4",
          broll: [] as BrollEntry[],
          captionSrc: "raw/captions.json",
          durationInFrames: 1736,
          hookText: "",
        }}
      />

      {/* Feature video templates */}
      <Folder name="FeatureVideos">
        <Composition<PhoneShowcaseProps>
          id="PhoneShowcase"
          component={PhoneShowcase}
          {...FEATURE_VIDEO_CONFIG}
          defaultProps={{
            screenshotSrc: "features/test.png",
            hookText: "Your coaching app can't do this",
            ctaText: 'DM me "DEMO" to try it free',
            featureLabel: "AI Meal Plans",
            featureDescription: "Auto-generated nutrition for every client",
          }}
        />

        <Composition<FeatureHighlightProps>
          id="FeatureHighlight"
          component={FeatureHighlight}
          {...FEATURE_VIDEO_CONFIG}
          defaultProps={{
            screenshotSrc: "features/test.png",
            hookText: "This one feature replaced 3 apps",
            ctaText: 'DM me "DEMO" to try it free',
            highlightX: 0.3,
            highlightY: 0.4,
            highlightW: 0.4,
            highlightH: 0.2,
            featureLabel: "Community Hub",
          }}
        />

        <Composition<BeforeAfterProps>
          id="BeforeAfter"
          component={BeforeAfter}
          {...FEATURE_VIDEO_CONFIG}
          defaultProps={{
            beforeSrc: "features/test.png",
            afterSrc: "features/test.png",
            hookText: "Stop paying for 5 apps when you need 1",
            ctaText: 'DM me "DEMO" to try it free',
            beforeLabel: "THEIR APP",
            afterLabel: "YOUR APP",
          }}
        />

        <Composition<StatRevealProps>
          id="StatReveal"
          component={StatReveal}
          {...FEATURE_VIDEO_CONFIG}
          defaultProps={{
            statValue: 100,
            statSuffix: "%",
            statLabel: "of your brand. Zero compromises.",
            hookText: "How much of your app is actually yours?",
            ctaText: 'DM me "DEMO" to try it free',
          }}
        />

        <Composition<QuickDemoProps>
          id="QuickDemo"
          component={QuickDemo}
          {...FEATURE_VIDEO_CONFIG}
          defaultProps={{
            screenshots: [
              "features/test.png",
              "features/test.png",
              "features/test.png",
            ],
            labels: ["Workouts", "Nutrition", "Community"],
            hookText: "Everything your clients need. One app.",
            ctaText: 'DM me "DEMO" to try it free',
          }}
        />
        <Composition<ScreenRecordingShowcaseProps>
          id="ScreenRecordingShowcase"
          component={ScreenRecordingShowcase}
          {...FEATURE_VIDEO_CONFIG}
          defaultProps={{
            recordingSrc: "features/workouts-recording.mp4",
            hookText: "Your clients deserve better than a spreadsheet",
            ctaText: 'DM me "DEMO" to try it free',
            featureLabel: "Workout Programs",
            featureDescription: "Drag-and-drop custom programs for every client",
            trimStart: 0,
          }}
        />
        <Composition<ProductDemoProps>
          id="ProductDemo"
          component={ProductDemo}
          {...FEATURE_VIDEO_CONFIG}
          defaultProps={{
            hookLine1: "Still duct-taping 5 apps together?",
            hookLine2: "There's a better way",
            tagline: "Your brand. Your app. 3 weeks.",
            ctaText: 'DM me "DEMO" to try it free',
            lifestyleSrc: "",
            scenes: [
              {
                src: "features/workouts-recording.mp4",
                label: "Custom Workouts",
                description: "Drag-and-drop programs for every client",
                isVideo: true,
                trimStart: 0,
              },
              {
                src: "features/nutrition-recording.mp4",
                label: "Nutrition Tracking",
                description: "Macros, meal plans, and food logging built in",
                isVideo: true,
                trimStart: 4,
              },
              {
                src: "features/community-recording.mp4",
                label: "Community Hub",
                description: "Keep your clients engaged and connected",
                isVideo: true,
                trimStart: 4,
              },
            ],
          }}
        />
      </Folder>
    </>
  );
};
