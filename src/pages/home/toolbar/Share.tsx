// fork 覆盖 1/1 —— 本文件整体替换官方 src/pages/home/toolbar/Share.tsx
//
// 相对官方 4.2.7 版的差异（**官方原有 UI 元素一律保持删除，不要合并回来**）：
//   已删除：Switch/Match 两态结构、生成后「复制消息」页脚分支、
//           分享 ID、备注(remark)、解压文件夹(extract_folder)、
//           排序方式(order_by)、排序方向(order_direction)、
//           自述文件(readme)、头部(header)、过期时间自由文本输入框、
//           Modal size 的 @xl/@2xl 档位
//   已改为：有效期改为下拉预设（默认 2 天）、确认后新增「复制并关闭」按钮
//
// 注意：`expires` 后端是 *time.Time，永不过期必须传 null（传 "" 会 JSON 解析失败）。
import { useFetch, useRouter, useT, useUtil } from "~/hooks"
import {
  bus,
  getExpireDate,
  handleResp,
  makeTemplateData,
  matchTemplate,
  r,
  randomPwd,
} from "~/utils"
import { batch, createSignal, onCleanup } from "solid-js"
import {
  Button,
  createDisclosure,
  HStack,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Text,
  Textarea,
  VStack,
} from "@hope-ui/solid"
import {
  ExtractFolder,
  OrderBy,
  OrderDirection,
  PResp,
  Share as ShareType,
  ShareInfo,
} from "~/types"
import { createStore } from "solid-js/store"
import { getSetting, me, selectedObjs } from "~/store"
import { TbRefresh } from "solid-icons/tb"
import { SelectOptions } from "~/components"

/** 有效期预设；`never` 为内部哨兵值，提交前转成 null */
const EXPIRE_NEVER = "never"
const EXPIRE_OPTIONS = [
  { label: "2天", value: "+2d" },
  { label: "1周", value: "+1w" },
  { label: "1月", value: "+30d" },
  { label: "1年", value: "+1y" },
  { label: "永久", value: EXPIRE_NEVER },
] as const

const DEFAULT_EXPIRE = "+2d"

export const Share = () => {
  const t = useT()
  const [link, setLink] = createSignal("")
  const { pathname } = useRouter()
  const { copy } = useUtil()
  const { isOpen, onOpen, onClose } = createDisclosure()

  const handler = (name: string) => {
    if (name === "share") {
      batch(() => {
        setLink("")
        const paths = selectedObjs().map((obj) => {
          const split =
            pathname().endsWith("/") || obj.name.startsWith("/") ? "" : "/"
          return `${me().base_path}${pathname()}${split}${obj.name}`
        })
        setShare({
          files: paths,
          expires: DEFAULT_EXPIRE,
          pwd: "",
          max_accessed: 0,
          order_by: OrderBy.None,
          order_direction: OrderDirection.None,
          extract_folder: ExtractFolder.None,
          remark: "",
          readme: "",
          header: "",
        } as ShareType)
      })
      onOpen()
    }
  }

  bus.on("tool", handler)
  onCleanup(() => bus.off("tool", handler))

  const [share, setShare] = createStore<ShareType>({} as ShareType)

  const [okLoading, ok] = useFetch((): PResp<ShareInfo> => {
    const finalShare: ShareType = { ...share }
    const expires = finalShare.expires
    if (expires === EXPIRE_NEVER) {
      finalShare.expires = null
    } else if (typeof expires === "string" && expires.startsWith("+")) {
      finalShare.expires = getExpireDate(expires).toISOString()
    }
    return r.post(`/share/create`, finalShare)
  })

  return (
    <Modal
      blockScrollOnMount={false}
      opened={isOpen()}
      onClose={onClose}
      size={{ "@initial": "xs", "@md": "md", "@lg": "lg" }}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("home.toolbar.share")}</ModalHeader>
        <ModalBody>
          <VStack spacing="$3" alignItems="stretch">
            {/* 分享码 */}
            <HStack spacing="$2" w="$full">
              <Text size="sm" whiteSpace="nowrap" minW="100px">
                {t("shares.pwd")}:
              </Text>
              <Input
                size="sm"
                value={share.pwd}
                onInput={(e) => setShare("pwd", e.currentTarget.value)}
              />
              <IconButton
                colorScheme="neutral"
                size="sm"
                aria-label="random"
                icon={<TbRefresh />}
                w="$8"
                flexShrink={0}
                onClick={() => setShare("pwd", randomPwd())}
              />
            </HStack>

            {/* 最大访问次数 */}
            <HStack spacing="$2" w="$full">
              <Text size="sm" whiteSpace="nowrap" minW="100px">
                {t("shares.max_accessed")}:
              </Text>
              <Input
                type="number"
                size="sm"
                value={share.max_accessed}
                onInput={(e) =>
                  setShare("max_accessed", parseInt(e.currentTarget.value))
                }
              />
            </HStack>

            {/* 有效期下拉（默认 2 天） */}
            <HStack spacing="$2" w="$full">
              <Text size="sm" whiteSpace="nowrap" minW="100px">
                {t("shares.expires")}:
              </Text>
              <Select
                size="sm"
                value={share.expires ?? ""}
                onChange={(val: string) => setShare("expires", val)}
              >
                <SelectOptions
                  options={EXPIRE_OPTIONS.map((opt) => ({
                    key: opt.value,
                    label: opt.label,
                  }))}
                />
              </Select>
            </HStack>

            {/* 分享结果 */}
            <VStack spacing="$1" alignItems="flex-start" mt="$2">
              <Text size="sm" fontWeight="$bold">
                分享信息:
              </Text>
              <Textarea
                readOnly
                placeholder="点击“确认”生成分享内容"
                size="sm"
                variant="filled"
                value={link()}
                rows={4}
              />
            </VStack>
          </VStack>
        </ModalBody>

        <ModalFooter display="flex" gap="$2">
          <Button colorScheme="neutral" onClick={onClose}>
            {t("global.cancel")}
          </Button>

          <Button
            colorScheme="info"
            loading={okLoading()}
            onClick={async () => {
              const resp = await ok()
              handleResp(resp, (data) => {
                const templateData = makeTemplateData(data, {
                  site_title: getSetting("site_title"),
                })
                const msg = matchTemplate(
                  getSetting("share_summary_content"),
                  templateData,
                )
                setLink(msg)
              })
            }}
          >
            {t("global.confirm")}
          </Button>

          <Button
            colorScheme="primary"
            disabled={!link()}
            onClick={() => {
              copy(link())
              onClose()
            }}
          >
            复制并关闭
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
