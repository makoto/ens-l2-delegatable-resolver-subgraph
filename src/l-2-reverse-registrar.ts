import {
  TextChanged as TextChangedEvent,
  NameChanged as NameChangedEvent,
  ReverseClaimed as ReverseClaimedEvent
} from "../generated/L2ReverseRegistrar/L2ReverseRegistrar"

import {
  TextChanged,
  NameChanged,
  ReverseClaimed,
  Domain,
  Resolver,
  Account
} from "../generated/schema"
import { Address, BigInt, Bytes, crypto, log } from '@graphprotocol/graph-ts'
import {
  decodeName,
  namehash,
  byteArrayFromHex,
  encodeHex
} from './utils'


export function handleName(node:Bytes, context:Bytes, dnsName:Bytes): void { 
  let domainId = createDomainID(node, context);
  let domain = Domain.load(domainId);
  if(!domain){
    domain = new Domain(domainId)
  }
  let decoded = decodeName(dnsName)
  if(decoded){    
    let labelName = decoded[0]
    let labelHex = encodeHex(labelName)
    let labelhash = crypto.keccak256(byteArrayFromHex(labelHex)).toHex()
    let name = decoded ? decoded[1] : ''
    domain.name = name
    domain.labelName = labelName
    domain.labelhash = Bytes.fromHexString(labelhash)
    if(decoded.length > 2){
      let parentEncoded = decoded ? decoded[3] : ''
      let parentNode = namehash(Bytes.fromHexString(parentEncoded))
      let parentDomainId = createDomainID(parentNode, context);
      let parentDomain = createDomain(
        parentNode,
        context
      )
      parentDomain.save()
      domain.parent = parentDomainId
      if(parentDomain.name == null){
        let decodedParent = decodeName(Bytes.fromHexString(parentEncoded))
        let parentLabelName = decodedParent ? decodedParent[0] : ''
        let parentLabelHex = encodeHex(parentLabelName)
        let parentLabelhash = crypto.keccak256(byteArrayFromHex(parentLabelHex)).toHex()
        let parentName = decodedParent ? decodedParent[1] : ''
        let parentParentName = decodedParent ? decodedParent[2] : ''
        parentDomain.name = parentName
        parentDomain.labelName = parentLabelName
        parentDomain.labelhash = Bytes.fromHexString(parentLabelhash)
      }
      parentDomain.save()  
    }
  }
  domain.save()
}

export function handleTextChanged(event: TextChangedEvent): void {
  let entity = new TextChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  let context = Bytes.fromHexString(event.address.toHexString())
  entity.node = event.params.node
  entity.context = context
  entity.key = event.params.key

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()

  let resolver = getOrCreateResolver(
    event.params.node,
    context,
    event.address,
  )
  let key = event.params.key;
  if(resolver.texts == null) {
    resolver.texts = [key];
    resolver.save();
  } else {
    let texts = resolver.texts!
    if(!texts.includes(key)){
      texts.push(key)
      resolver.texts = texts
      resolver.save()
    }
  }
  resolver.save();
  let domain = createDomain(
    event.params.node,
    context,
    resolver.id
  )
  domain.save()
}

export function handleNameChanged(event: NameChangedEvent): void {
  let entity = new NameChanged(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  let context = Bytes.fromHexString(event.address.toHexString())
  entity.node = event.params.node
  entity.context = context
  entity.name = event.params.name

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()

  let resolver = getOrCreateResolver(
    event.params.node,
    context,
    event.address,
  )
  resolver.name = event.params.name;
  resolver.save();
  let domain = createDomain(
    event.params.node,
    context,
    resolver.id
  )
  domain.save()
}

export function handleReverseClaimed(event: ReverseClaimedEvent): void {
  let entity = new ReverseClaimed(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  let context = Bytes.fromHexString(event.address.toHexString())
  entity.node = event.params.node
  entity.context = context
  entity.addr = event.params.addr
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
  let account = Account.load(event.params.addr.toHexString());
  if(!account){
    account = new Account(event.params.addr.toHexString());
  }

  let resolver = getOrCreateResolver(
    event.params.node,
    context,
    event.address,
  )
  resolver.save();
  let domain = createDomain(
    event.params.node,
    context,
    resolver.id
  )
  domain.save()
  account.domain = domain.id
  account.save()
}


function getOrCreateResolver(node: Bytes, context: Bytes, address: Address): Resolver {
  let id = createResolverID(node, context, address);
  let resolver = Resolver.load(id);
  if (resolver === null) {
    resolver = new Resolver(id);
    resolver.domain = node.toHexString();
    resolver.node = node;
    resolver.context = context;
    resolver.address = address;
  }
  return resolver as Resolver;
}

function createDomain(node: Bytes, context: Bytes, resolverId: string = ''): Domain{
  let domain = new Domain(createDomainID(node, context));  
  domain.namehash = node;
  if(resolverId != ''){
    domain.resolver = resolverId;
    domain.context = context;
  }
  let account = Account.load(context.toHexString());
  if(!account){
    account = new Account(context.toHexString());
  }
  domain.owner = account.id;
  domain.context = context;
  domain.save()
  account.save()
  return domain
}

function createResolverID(node: Bytes, context: Bytes, resolver: Address): string {
  return resolver
    .toHexString()
    .concat("-")
    .concat(
      context
      .toHexString()
      .concat("-")
      .concat(
        node.toHexString()
      )
    );
}

function createDomainID(node: Bytes, context: Bytes): string {
  return context
    .toHexString()
    .concat("-")
    .concat(node.toHexString());
}