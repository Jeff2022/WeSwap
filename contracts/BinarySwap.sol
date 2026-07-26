// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SimpleSwap is Ownable {

    IERC20 public immutable usdc;

    // 1 AVAX = price USDC,  price USDC/AVAX
    // USDC有6位精度
    uint256 public price = 6.5 * 1e6;
    uint256 constant slippage = 1; // in percentage

    constructor() Ownable(msg.sender) {
        // USDC address on Fuji test net
        usdc = IERC20(0x5425890298aed601595a70AB815c96711a31Bc65);
    }

    function approveUSDC(uint256 amount) external {
        IERC20(usdc).approve(address(this), amount);
    }

    // ----------------------------
    // USDC -> AVAX
    // ----------------------------
    function swapUSDCForAVAX(uint256 usdcAmount) external {

        require(
            (this.maxUSDCtoSwap() >= usdcAmount),
            "AVAX Amount insufficiet"
        );

        uint256 avaxAmount = this.estimateAVAXtoReceive(usdcAmount);


        require(this.balanceOfAVAX() > avaxAmount, "No sufficient AVAX!");

        
        IERC20(usdc).transferFrom(msg.sender, address(this), usdcAmount);


        // payable(msg.sender).transfer(avaxAmount);

        (bool success, ) = payable(msg.sender).call{value: avaxAmount}("");
        require(success, "pay AVAX failed");


    }

    // ----------------------------
    // AVAX -> USDC
    // ----------------------------
    function swapAVAXForUSDC() external payable {

        require(
            (this.maxAVAXtoSwap() >= msg.value),
            "USDC Amount insufficiet"
        );


        uint256 usdcAmount = this.estimateUSDCtoReceive(msg.value);

        require(
            usdc.balanceOf(address(this)) >= usdcAmount,
            "insufficient USDC"
        );

        usdc.transfer(msg.sender, usdcAmount);
    }

    function estimateAVAXtoReceive(uint256 usdcAmount) external view returns(uint256) {
        uint256 avaxAmount =
            usdcAmount * 1 ether * (100 - slippage)/ (price * 100);
        return avaxAmount;
    }

    function estimateUSDCtoReceive(uint256 avaxAmount) external view returns(uint256) {
        uint256 usdcAmount =
            avaxAmount * price * (100-slippage) /(1 ether * 100);
        
        return usdcAmount;
    }

    // LP充值AVAX
    receive() external payable {}

    function maxUSDCtoSwap()external view returns(uint256) {
        return maxAVAXtoReceive() * price / 1 ether; //USDC Decimal 6
    }

    function maxAVAXtoSwap()external view returns(uint256) {
        return maxUSDCtoReceive() * 1 ether / price;
    }


    function maxAVAXtoReceive()internal view returns(uint256) {
        uint256 balance_AVAX = this.balanceOfAVAX();
        uint256 maxLimit = 2 * 1 ether;
        if (balance_AVAX > (maxLimit * 2)) {
            return maxLimit;
        }else{
            return balance_AVAX / 2;
        }
    }

    function maxUSDCtoReceive()internal view returns(uint256) {
        uint256 balance_USDC = this.balanceOfUSDC();
        uint256 maxLimit = 20 * (10 ** 6);
        if (balance_USDC > (maxLimit * 2)) {
            return maxLimit;
        }else{
            return balance_USDC / 2;
        }
    }

    function balanceOfUSDC() external view returns(uint256) {
        return usdc.balanceOf(address(this));
    } 

    function balanceOfAVAX() external view returns(uint256) {
        return address(this).balance;
    } 
 
    // 提现
    function withdrawAVAX(uint256 amount) external onlyOwner {
        payable(owner()).transfer(amount);
    }

    function withdrawUSDC(uint256 amount) external onlyOwner {
        usdc.transfer(owner(), amount);
    }

    function setPrice(uint256 newPrice) external onlyOwner {
        price = newPrice;
    }
}
