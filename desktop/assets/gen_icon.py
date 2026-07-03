"""
gen_icon.py — 8비트 픽셀아트 앱 아이콘 생성 (고고학용 트라울 + 흙)

날-볼스터-손잡이-페룰을 하나의 연속된 폭 함수(width(t))로 정의해 외곽선
전체를 단일 폴리곤으로 그린다 — 구간을 따로 그리면 이음매에 픽셀 틈이
생기므로, 색만 구간별로 같은 경계 함수로 채워 넣는다.

저해상도 원본(96x96)에 안티앨리어싱 없이 그려 픽셀아트 특유의 각진
가장자리를 얻은 뒤, 각 목표 해상도로 매번 원본에서 새로 NEAREST 확대해
.ico/.png를 만든다 (이미 확대된 걸 다시 축소하면 흐려짐).

실행: python desktop/assets/gen_icon.py
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

OUT_DIR = Path(__file__).parent
N = 96

OUTLINE      = (28, 22, 19, 255)
BLADE_FILL   = (210, 214, 218, 255)
BLADE_SHADE  = (146, 152, 160, 255)
BOLSTER      = (104, 108, 116, 255)
HANDLE_FILL  = (178, 118, 68, 255)
HANDLE_SHADE = (126, 79, 42, 255)
HANDLE_HI    = (216, 168, 112, 255)
FERRULE      = (182, 186, 192, 255)
FERRULE_SHADE = (130, 134, 140, 255)
SOIL_DARK    = (62, 38, 21, 255)
SOIL_BASE    = (96, 60, 34, 255)
SOIL_MID     = (130, 84, 47, 255)
SOIL_HI      = (168, 116, 68, 255)

BLADE_LEN, BOLSTER_LEN, HANDLE_LEN, FERRULE_LEN = 24.0, 5.0, 26.0, 4.0
T_BOLSTER = BLADE_LEN
T_HANDLE  = T_BOLSTER + BOLSTER_LEN
T_FERRULE = T_HANDLE + HANDLE_LEN
T_END     = T_FERRULE + FERRULE_LEN

HEEL_W, HANDLE_W, FERRULE_W = 2.6, 2.15, 2.6
BLADE_PEAK_W, BLADE_PEAK_U = 7.8, 0.46


def width(t):
    """도구 전체 실루엣의 t지점 반폭(half-width). 이음매 없는 단일 함수."""
    if t <= BLADE_LEN:
        u = t / BLADE_LEN
        if u <= BLADE_PEAK_U:
            return BLADE_PEAK_W * math.sin(math.pi / 2 * (u / BLADE_PEAK_U))
        u2 = (u - BLADE_PEAK_U) / (1 - BLADE_PEAK_U)
        return HEEL_W + (BLADE_PEAK_W - HEEL_W) * math.cos(math.pi / 2 * u2)
    if t <= T_BOLSTER + BOLSTER_LEN:
        u = (t - T_BOLSTER) / BOLSTER_LEN
        bulge = math.sin(math.pi * u) * 0.5
        return HEEL_W + (HANDLE_W - HEEL_W) * u + bulge
    if t <= T_FERRULE:
        return HANDLE_W
    if t <= T_END:
        u = (t - T_FERRULE) / FERRULE_LEN
        return HANDLE_W + (FERRULE_W - HANDLE_W) * min(1.0, u / 0.5)
    return FERRULE_W


def edge_points(t0, t1, step=0.4, upper=True):
    n = max(2, int((t1 - t0) / step))
    pts = []
    for i in range(n + 1):
        t = t0 + (t1 - t0) * i / n
        pts.append((t, width(t) if upper else -width(t)))
    return pts


def to_xy(tip, ax, ay, px, py, t, w):
    return (tip[0] + ax * t + px * w, tip[1] + ay * t + py * w)


def build_axis(tip_x, tip_y, angle_deg):
    a = math.radians(angle_deg)
    ax, ay = math.cos(a), math.sin(a)
    px, py = -ay, ax
    return (tip_x, tip_y), ax, ay, px, py


def segment_polygon(tip, ax, ay, px, py, t0, t1):
    up = edge_points(t0, t1, upper=True)
    lo = edge_points(t0, t1, upper=False)
    pts = [to_xy(tip, ax, ay, px, py, t, w) for t, w in up]
    pts += [to_xy(tip, ax, ay, px, py, t, w) for t, w in reversed(lo)]
    return pts


def draw_soil(d, tip, ax, ay, px, py):
    # 날 폭이 넓어지는 뒷부분(자루 쪽으로 치우침)에 흙을 얹어 날 끝(포인트)이
    # 드러나 보이게 한다 — 트라울 실루엣과 흙이 둘 다 읽혀야 함
    t_c = BLADE_LEN * 0.72
    w_c = width(t_c)
    cx, cy = to_xy(tip, ax, ay, px, py, t_c, w_c * 0.5)

    mound = [
        (cx - 6.5, cy + 1.2), (cx - 4.8, cy - 2.8), (cx - 1.8, cy - 5.2),
        (cx + 1.5, cy - 5.8), (cx + 4.5, cy - 3.6), (cx + 5.8, cy - 0.5),
        (cx + 4.8, cy + 2.2), (cx + 0.8, cy + 2.8), (cx - 3.2, cy + 2.4),
    ]
    d.polygon(mound, fill=SOIL_BASE, outline=OUTLINE, width=1)
    d.polygon([(cx - 4.0, cy - 1.0), (cx - 2.0, cy - 3.8), (cx + 0.5, cy - 4.6),
                (cx + 1.5, cy - 2.0), (cx - 1.2, cy - 0.5)], fill=SOIL_MID)
    d.polygon([(cx - 0.2, cy - 3.5), (cx + 1.8, cy - 5.0), (cx + 3.5, cy - 2.8),
                (cx + 2.0, cy - 1.2)], fill=SOIL_HI)
    d.ellipse([cx - 5.2, cy - 0.3, cx - 3.2, cy + 1.5], fill=SOIL_DARK)
    d.ellipse([cx + 2.5, cy - 0.3, cx + 4.5, cy + 1.5], fill=SOIL_DARK)

    # 흩날리는 흙 알갱이 — 날 끝(핸들 반대쪽) 방향으로만 배치해 동적인 느낌
    for dx, dy, c, s in [(-9.0, -1.5, SOIL_MID, 1.7), (-10.8, 1.8, SOIL_BASE, 1.5),
                           (-7.5, 4.5, SOIL_DARK, 1.5), (-2.0, -8.0, SOIL_BASE, 1.4)]:
        d.rectangle([cx + dx, cy + dy, cx + dx + s, cy + dy + s], fill=c)


def render_base():
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    tip, ax, ay, px, py = build_axis(20.0, 76.0, -33)

    # 단일 실루엣 외곽선 (이음매 없음)
    silhouette = segment_polygon(tip, ax, ay, px, py, 0.0, T_END)
    d.polygon(silhouette, fill=BLADE_SHADE, outline=OUTLINE, width=1)

    # 날 상단 밝은면 (축 upper쪽 절반만 밝게 — 입체감)
    up = edge_points(0.0, BLADE_LEN, upper=True)
    axis_pts = [(t, 0.0) for t, _ in up]
    bright = [to_xy(tip, ax, ay, px, py, t, w) for t, w in up]
    bright += [to_xy(tip, ax, ay, px, py, t, w) for t, w in reversed(axis_pts)]
    d.polygon(bright, fill=BLADE_FILL)

    # 볼스터
    d.polygon(segment_polygon(tip, ax, ay, px, py, T_BOLSTER - 0.5, T_HANDLE), fill=BOLSTER)

    # 손잡이 (상단 하이라이트 줄무늬 포함)
    d.polygon(segment_polygon(tip, ax, ay, px, py, T_HANDLE - 0.5, T_FERRULE + 0.5), fill=HANDLE_SHADE)
    up_h = edge_points(T_HANDLE, T_FERRULE, upper=True)
    mid_h = [(t, w * 0.15) for t, w in up_h]
    hi = [to_xy(tip, ax, ay, px, py, t, w) for t, w in up_h]
    hi += [to_xy(tip, ax, ay, px, py, t, w) for t, w in reversed(mid_h)]
    d.polygon(hi, fill=HANDLE_FILL)
    up_h2 = edge_points(T_HANDLE, T_FERRULE, upper=True)
    hi2_outer = [(t, w * 0.55) for t, w in up_h2]
    hi2_inner = [(t, w * 0.2) for t, w in up_h2]
    hi2 = [to_xy(tip, ax, ay, px, py, t, w) for t, w in hi2_outer]
    hi2 += [to_xy(tip, ax, ay, px, py, t, w) for t, w in reversed(hi2_inner)]
    d.polygon(hi2, fill=HANDLE_HI)

    # 페룰 (손잡이 끝 금속 캡)
    d.polygon(segment_polygon(tip, ax, ay, px, py, T_FERRULE, T_END), fill=FERRULE)
    ferrule_shade = segment_polygon(tip, ax, ay, px, py, T_FERRULE, (T_FERRULE + T_END) / 2)
    d.polygon(ferrule_shade, fill=FERRULE_SHADE)
    d.polygon(silhouette, outline=OUTLINE, width=1)

    draw_soil(d, tip, ax, ay, px, py)

    return img


def recenter(img, fill=0.92):
    """콘텐츠 bbox로 잘라 캔버스의 fill 비율만큼 채우도록 확대한 뒤 중앙 배치.
    16px처럼 작은 크기에서도 뭉개지지 않도록 여백을 최소화한다."""
    bbox = img.getbbox()
    if not bbox:
        return img
    cropped = img.crop(bbox)
    w, h = cropped.size
    scale = (N * fill) / max(w, h)
    cropped = cropped.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.NEAREST)
    out = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    ox = (N - cropped.width) // 2
    oy = (N - cropped.height) // 2
    out.paste(cropped, (ox, oy), cropped)
    return out


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    base = recenter(render_base())

    preview = base.resize((N * 6, N * 6), Image.NEAREST)
    preview.save(OUT_DIR / "icon_preview.png")

    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    ico_images = [base.resize((s, s), Image.NEAREST) for s in ico_sizes]
    ico_images[-1].save(
        OUT_DIR / "icon.ico", format="ICO",
        sizes=[(s, s) for s in ico_sizes],
        append_images=ico_images[:-1],
    )
    base.resize((64, 64), Image.NEAREST).save(OUT_DIR / "favicon.png")

    print(f"OK: {OUT_DIR / 'icon_preview.png'}")
    print(f"OK: {OUT_DIR / 'icon.ico'} ({len(ico_sizes)} sizes)")
    print(f"OK: {OUT_DIR / 'favicon.png'}")


if __name__ == "__main__":
    main()
