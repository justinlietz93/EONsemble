import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, WheelEvent } from 'react'

import { GraphConnection, GraphNodeWithLayout } from './types'

interface GraphCanvasProps {
  nodes: GraphNodeWithLayout[]
  connections: GraphConnection[]
  zoom: number
  panX: number
  panY: number
  selectedNodeId?: string
  onSelectNode: (nodeId: string | null) => void
  onPanChange: (x: number, y: number) => void
  onZoomChange: (zoom: number) => void
}

export function GraphCanvas({
  nodes,
  connections,
  zoom,
  panX,
  panY,
  selectedNodeId,
  onSelectNode,
  onPanChange,
  onZoomChange
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const lastMousePos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (nodes.length === 0) {
      return
    }

    ctx.save()
    ctx.translate(panX, panY)
    ctx.scale(zoom, zoom)

    connections.forEach(conn => {
      const sourceNode = nodes.find(n => n.id === conn.source)
      const targetNode = nodes.find(n => n.id === conn.target)

      if (sourceNode?.x && sourceNode?.y && targetNode?.x && targetNode?.y) {
        const strength = conn.strength ?? 0.3
        const alpha = Math.min(0.9, 0.25 + strength * 0.6)
        const width = (0.4 + strength * 1.6) / zoom
        const isSimilarity = conn.relationship === 'similar_to'

        ctx.strokeStyle = isSimilarity
          ? `rgba(59, 130, 246, ${alpha})`
          : `rgba(229, 231, 235, ${alpha})`
        ctx.lineWidth = width
        ctx.beginPath()
        ctx.moveTo(sourceNode.x, sourceNode.y)
        ctx.lineTo(targetNode.x, targetNode.y)
        ctx.stroke()
      }
    })

    nodes.forEach(node => {
      if (!node.x || !node.y) return

      const isSelected = selectedNodeId === node.id
      const radius = (node.radius || 8) * (isSelected ? 1.5 : 1)

      const colors = {
        goal: '#3b82f6',
        agent_response: '#10b981',
        knowledge_entry: '#8b5cf6',
        concept: '#f59e0b'
      }

      ctx.fillStyle = colors[node.type]
      ctx.beginPath()
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI)
      ctx.fill()

      if (isSelected) {
        ctx.strokeStyle = '#1f2937'
        ctx.lineWidth = 3 / zoom
        ctx.stroke()
      }

      if (radius > 6 || zoom > 0.8 || isSelected) {
        ctx.fillStyle = '#1f2937'
        ctx.font = `${Math.max(10, radius) / zoom}px Inter`
        ctx.textAlign = 'center'
        const maxLength = Math.floor(radius * 2 * zoom)
        const label =
          node.label.length > maxLength ? `${node.label.substring(0, maxLength)}...` : node.label
        ctx.fillText(label, node.x, node.y + radius + 15 / zoom)
      }
    })

    ctx.restore()
  }, [nodes, connections, selectedNodeId, zoom, panX, panY])

  const handleClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || isDragging) return

    const rect = canvas.getBoundingClientRect()
    const x = (event.clientX - rect.left - panX) / zoom
    const y = (event.clientY - rect.top - panY) / zoom

    for (const node of nodes) {
      if (!node.x || !node.y) continue

      const distance = Math.sqrt(Math.pow(x - node.x, 2) + Math.pow(y - node.y, 2))
      if (distance <= (node.radius || 8) + 5) {
        onSelectNode(node.id)
        return
      }
    }

    onSelectNode(null)
  }

  const handleMouseDown = (event: MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true)
    lastMousePos.current = { x: event.clientX, y: event.clientY }
  }

  const handleMouseMove = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return

    const deltaX = event.clientX - lastMousePos.current.x
    const deltaY = event.clientY - lastMousePos.current.y

    onPanChange(panX + deltaX, panY + deltaY)
    lastMousePos.current = { x: event.clientX, y: event.clientY }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (event: WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault()

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top

    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(0.1, Math.min(3, zoom * zoomFactor))
    const zoomChange = newZoom / zoom

    const newPanX = mouseX - (mouseX - panX) * zoomChange
    const newPanY = mouseY - (mouseY - panY) * zoomChange

    onPanChange(newPanX, newPanY)
    onZoomChange(newZoom)
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      className={`w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
    />
  )
}
