import { useEffect, useRef, useState } from 'react'

import { GraphConnection, GraphNodeBase, GraphNodeWithLayout } from './types'

const VIRTUAL_WIDTH = 2000
const VIRTUAL_HEIGHT = 1500
const GRAVITY = 0.005
const REPULSION = 2000
const ATTRACTION = 0.05
const TYPE_ATTRACTION = 0.02
const ALPHA = 0.08
const DAMPING = 0.85

const RANDOM_MARGIN = 100

const createRandomCoordinate = (limit: number) =>
  Math.random() * (limit - RANDOM_MARGIN * 2) + RANDOM_MARGIN

const mergeNodesWithLayout = (
  baseNodes: GraphNodeBase[],
  previousNodes: GraphNodeWithLayout[]
): GraphNodeWithLayout[] => {
  const previousById = new Map(previousNodes.map(node => [node.id, node]))

  return baseNodes.map(baseNode => {
    const previous = previousById.get(baseNode.id)
    if (previous) {
      return {
        ...baseNode,
        x: previous.x,
        y: previous.y,
        vx: previous.vx,
        vy: previous.vy
      }
    }

    return {
      ...baseNode,
      x: createRandomCoordinate(VIRTUAL_WIDTH),
      y: createRandomCoordinate(VIRTUAL_HEIGHT),
      vx: 0,
      vy: 0
    }
  })
}

const applyBounds = (value: number, radius = 10, max = 0) => {
  if (max === 0) return value
  const margin = radius + 20
  return Math.max(margin, Math.min(max - margin, value))
}

const buildConnectionLookup = (connections: GraphConnection[]) => {
  const map = new Map<string, GraphConnection[]>()
  connections.forEach(connection => {
    if (!map.has(connection.source)) {
      map.set(connection.source, [])
    }
    if (!map.has(connection.target)) {
      map.set(connection.target, [])
    }
    map.get(connection.source)!.push(connection)
    map.get(connection.target)!.push({
      source: connection.target,
      target: connection.source,
      relationship: connection.relationship,
      strength: connection.strength
    })
  })
  return map
}

export function useGraphLayout(
  nodes: GraphNodeBase[],
  connections: GraphConnection[]
): GraphNodeWithLayout[] {
  const [layoutNodes, setLayoutNodes] = useState<GraphNodeWithLayout[]>(() =>
    mergeNodesWithLayout(nodes, [])
  )
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    setLayoutNodes(prev => mergeNodesWithLayout(nodes, prev))
  }, [nodes])

  useEffect(() => {
    if (nodes.length === 0) {
      return
    }

    const hasAnimationFrame =
      typeof window !== 'undefined' &&
      typeof window.requestAnimationFrame === 'function' &&
      typeof window.cancelAnimationFrame === 'function'

    if (!hasAnimationFrame) {
      return
    }

    const connectionLookup = buildConnectionLookup(connections)

    const simulate = () => {
      setLayoutNodes(prevNodes => {
        if (prevNodes.length === 0) return prevNodes

        const nextNodes = prevNodes.map(node => ({ ...node }))
        const indexMap = new Map<string, number>()
        nextNodes.forEach((node, index) => {
          indexMap.set(node.id, index)
        })

        for (let i = 0; i < nextNodes.length; i++) {
          const node = nextNodes[i]
          if (node.x === undefined || node.y === undefined) continue

          let fx = 0
          let fy = 0

          const centerX = VIRTUAL_WIDTH / 2
          const centerY = VIRTUAL_HEIGHT / 2
          fx += (centerX - node.x) * GRAVITY
          fy += (centerY - node.y) * GRAVITY

          for (let j = 0; j < nextNodes.length; j++) {
            if (i === j) continue
            const other = nextNodes[j]
            if (other.x === undefined || other.y === undefined) continue

            const dx = node.x - other.x
            const dy = node.y - other.y
            const distance = Math.sqrt(dx * dx + dy * dy) || 1
            const force = REPULSION / (distance * distance)
            fx += (dx / distance) * force
            fy += (dy / distance) * force
          }

          const neighbors = connectionLookup.get(node.id) || []
          neighbors.forEach(connection => {
            const connectedIndex = indexMap.get(connection.target)
            if (connectedIndex === undefined) return
            const connected = nextNodes[connectedIndex]
            if (!connected?.x || !connected?.y || !node.x || !node.y) return

            const dx = connected.x - node.x
            const dy = connected.y - node.y
            const distance = Math.sqrt(dx * dx + dy * dy) || 1

            const relationshipBoost = connection.relationship === 'similar_to' ? 1.4 : 1
            const connectionForce = ATTRACTION * relationshipBoost * (connection.strength ?? 0.4)
            const scaledDistance = Math.min(distance / 250, 1)
            fx += (dx / distance) * connectionForce * scaledDistance
            fy += (dy / distance) * connectionForce * scaledDistance
          })

          for (let j = 0; j < nextNodes.length; j++) {
            if (i === j) continue
            const other = nextNodes[j]
            if (other.x === undefined || other.y === undefined || other.type !== node.type) {
              continue
            }

            const dx = other.x - node.x
            const dy = other.y - node.y
            const distance = Math.sqrt(dx * dx + dy * dy) || 1
            if (distance < 300) {
              fx += (dx / distance) * TYPE_ATTRACTION * (300 - distance) / 300
              fy += (dy / distance) * TYPE_ATTRACTION * (300 - distance) / 300
            }
          }

          node.vx = (node.vx || 0) * DAMPING + fx * ALPHA
          node.vy = (node.vy || 0) * DAMPING + fy * ALPHA
          node.x += node.vx
          node.y += node.vy

          node.x = applyBounds(node.x, node.radius || 10, VIRTUAL_WIDTH)
          node.y = applyBounds(node.y, node.radius || 10, VIRTUAL_HEIGHT)
        }

        return nextNodes
      })

      animationRef.current = requestAnimationFrame(simulate)
    }

    animationRef.current = window.requestAnimationFrame(simulate)

    return () => {
      if (animationRef.current) {
        window.cancelAnimationFrame(animationRef.current)
      }
    }
  }, [nodes.length, connections])

  return layoutNodes
}
