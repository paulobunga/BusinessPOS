import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { randomUUID } from 'crypto'
import { aiConfigService } from './aiConfigService.js'
import { chatRepo } from '../db/repositories/chatRepo.js'
import { runAssistant } from '../ai/service.js'
import type { AiChatMessage, AiToolCall, AiEvent, Role } from '../../shared/types.js'

type ApproveResolver = (approved: boolean) => void

const pendingApprovals = new Map<string, ApproveResolver>()

function resolveApproval(requestId: string, callId: string, approved: boolean) {
  const key = `${requestId}:${callId}`
  const resolve = pendingApprovals.get(key)
  if (resolve) {
    pendingApprovals.delete(key)
    resolve(approved)
  }
}

export function registerAiHandlers() {
  ipcMain.handle('ai:sessions:list', () => chatRepo.listSessions())
  ipcMain.handle('ai:sessions:create', (_e, title?: string) => chatRepo.createSession(title))
  ipcMain.handle('ai:sessions:rename', (_e, id: number, title: string) => chatRepo.renameSession(id, title))
  ipcMain.handle('ai:sessions:delete', (_e, id: number) => chatRepo.deleteSession(id))

  ipcMain.handle('ai:chat:messages', (_e, sessionId: number): AiChatMessage[] => chatRepo.listMessages(sessionId))

  ipcMain.handle('ai:config:get', () => aiConfigService.get())
  ipcMain.handle('ai:config:save', (_e, payload: { apiKey?: string; model: string }) => aiConfigService.save(payload))

  ipcMain.handle('ai:toolApproval', (_e, payload: { requestId: string; callId: string; approved: boolean }) => {
    resolveApproval(payload.requestId, payload.callId, payload.approved)
  })

  ipcMain.handle('ai:chat:start', async (event: IpcMainInvokeEvent, payload: { sessionId: number; content: string; userId: number; role: Role }) => {
    const requestId = randomUUID()
    const emit = (e: AiEvent) => {
      if (!event.sender.isDestroyed()) event.sender.send('ai:event', e)
    }
    const waitForApproval = (call: AiToolCall) =>
      new Promise<boolean>((resolve) => {
        pendingApprovals.set(`${requestId}:${call.id}`, resolve)
      })

    runAssistant({
      sessionId: payload.sessionId,
      content: payload.content,
      userId: payload.userId,
      role: payload.role,
      emit,
      waitForApproval,
    }).catch((err) => {
      const message = chatRepo.saveAssistantMessage(
        payload.sessionId,
        '',
        null,
        err instanceof Error ? err.message : String(err)
      )
      if (!event.sender.isDestroyed()) emit({ type: 'error', requestId, message })
    })

    return { requestId }
  })
}